/* ============================================================
   TURNOBARBER
   MI PANTALLA DE BARBERO
   ============================================================ */

let barberProfile = null;
let barberQueue = [];
let barberCurrentTicket = null;
let barberLoading = false;
let barberActionRunning = false;
let barberRefreshTimer = null;
let barberBusiness = null;
let barberBusinessTimezone = "America/Bogota";
let barberModuleInitialized = false;
let barberModuleStarting = false;


/* ============================================================
   ELEMENTOS
   ============================================================ */

const barberDashboard =
    document.getElementById(
        "barberDashboard"
    );


/* ============================================================
   CLIENTE SUPABASE AISLADO PARA EL BARBERO
   ============================================================ */

/*
 * IMPORTANTE:
 * El administrador y la estación del barbero no deben compartir
 * la misma sesión persistente del navegador.
 *
 * supabase.js mantiene "client" para Admin/propietario.
 * Aquí creamos un cliente independiente con otra clave de
 * almacenamiento para que la sesión de Juan (o cualquier barbero)
 * no pueda reemplazar la sesión del administrador.
 */
const barberClient =
    window.supabase.createClient(
        SUPABASE_URL,
        SUPABASE_ANON_KEY,
        {
            auth: {
                storageKey:
                    "turnobarber_barber_auth",
                persistSession:
                    true,
                autoRefreshToken:
                    true,
                detectSessionInUrl:
                    false
            }
        }
    );


window.barberClient =
    barberClient;


/* ============================================================
   UTILIDADES
   ============================================================ */

function escapeBarberHtml(value) {

    return String(
        value ?? ""
    )
        .replace(
            /&/g,
            "&amp;"
        )
        .replace(
            /</g,
            "&lt;"
        )
        .replace(
            />/g,
            "&gt;"
        )
        .replace(
            /"/g,
            "&quot;"
        )
        .replace(
            /'/g,
            "&#039;"
        );

}


function normalizeStatus(status) {

    return String(
        status ?? ""
    )
        .trim()
        .toLowerCase();

}


function isWaitingStatus(status) {

    const value =
        normalizeStatus(status);

    return [
        "waiting",
        "pending",
        "queued",
        "queue",
        "en_espera",
        "esperando",
        "pendiente"
    ].includes(value);

}


function isCurrentStatus(status) {

    const value =
        normalizeStatus(status);

    return [
        "called",
        "calling",
        "serving",
        "in_progress",
        "in-progress",
        "attending",
        "atendiendo",
        "llamado",
        "llamando",
        "en_atencion",
        "en-atencion"
    ].includes(value);

}


function isFinishedStatus(status) {

    const value =
        normalizeStatus(status);

    return [
        "completed",
        "complete",
        "finished",
        "finish",
        "served",
        "done",
        "closed",
        "no_show",
        "no-show",
        "noshow",
        "skipped",
        "cancelled",
        "canceled",
        "cancelado",
        "finalizado"
    ].includes(value);

}


/* ============================================================
   OBTENER SESIÓN
   ============================================================ */

async function getBarberSession() {

    const {
        data,
        error
    } =
        await barberClient.auth.getSession();


    if (error) {

        throw error;

    }


    if (
        !data ||
        !data.session ||
        !data.session.user
    ) {

        return null;

    }


    return data.session;

}


/* ============================================================
   CARGAR PERFIL DEL BARBERO
   ============================================================ */

async function loadBarberProfile() {

    const {
        data,
        error
    } =
        await barberClient.rpc(
            "get_my_barber"
        );


    if (error) {

        throw error;

    }


    if (
        !data ||
        data.length === 0
    ) {

        return null;

    }


    return data[0];

}


/* ============================================================
   CARGAR BARBERÍA DEL BARBERO
   ============================================================ */

async function loadBarberBusiness() {

    try {

        const {
            data: stationData,
            error: stationError
        } =
            await barberClient.rpc(
                "get_my_barber_station_with_profile"
            );


        if (stationError) {

            console.warn(
                "NO SE PUDO CARGAR LA ESTACIÓN DEL BARBERO:",
                stationError
            );

            return null;

        }


        const station =
            Array.isArray(stationData)
                ? stationData[0] || null
                : stationData || null;


        if (!station) {

            return null;

        }


        let city =
            station.business_city ||
            "";

        // La estación puede traer directamente la imagen de la barbería.
        // La usamos primero y dejamos el RPC de negocio como respaldo.
        let profileImageUrl =
            station.profile_image_url ||
            null;


        /*
         * get_my_barber_station_with_profile es la fuente principal para los
         * datos de la estación y la identidad de la barbería, incluyendo
         * la imagen de perfil. Intentamos obtener además la ciudad
         * desde la información de negocio cuando el usuario tenga
         * acceso a ella. Si no está disponible, no rompemos la estación.
         */
        try {

            const {
                data: businessData,
                error: businessError
            } =
                await barberClient.rpc(
                    "get_my_business"
                );


            if (!businessError) {

                const business =
                    Array.isArray(businessData)
                        ? businessData[0] || null
                        : businessData || null;


                if (business?.city) {

                    city =
                        business.city;

                }

                if (business?.profile_image_url) {
                    profileImageUrl =
                        business.profile_image_url;
                }

            }

        } catch (error) {

            console.warn(
                "NO SE PUDO OBTENER LA CIUDAD DE LA BARBERÍA:",
                error
            );

        }


        return {
            id: station.business_id,
            name: station.business_name,
            city,
            profileImageUrl,
            timezone: station.timezone || null
        };

    } catch (error) {

        console.warn(
            "ERROR CARGANDO BARBERÍA:",
            error
        );

        return null;

    }

}


/* ============================================================
   FECHA Y HORA DE LA BARBERÍA
   ============================================================ */

function formatBarberDateTime() {

    const timezone =
        barberBusinessTimezone ||
        "America/Bogota";


    const now =
        new Date();


    let dateText = "";
    let timeText = "";


    try {

        dateText =
            new Intl.DateTimeFormat(
                "es-CO",
                {
                    weekday: "short",
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                    timeZone: timezone
                }
            ).format(now);


        timeText =
            new Intl.DateTimeFormat(
                "es-CO",
                {
                    hour: "numeric",
                    minute: "2-digit",
                    hour12: true,
                    timeZone: timezone
                }
            ).format(now);

    } catch (error) {

        console.warn(
            "ERROR FORMATEANDO FECHA/HORA:",
            error
        );

        dateText =
            now.toLocaleDateString(
                "es-CO",
                {
                    weekday: "short",
                    day: "numeric",
                    month: "short",
                    year: "numeric"
                }
            );

        timeText =
            now.toLocaleTimeString(
                "es-CO",
                {
                    hour: "numeric",
                    minute: "2-digit",
                    hour12: true
                }
            );

    }


    return {
        dateText,
        timeText
    };

}


/* ============================================================
   CARGAR COLA
   ============================================================ */

async function loadBarberQueue() {

    const {
        data,
        error
    } =
        await barberClient.rpc(
            "barber_my_queue"
        );


    if (error) {

        throw error;

    }


    barberQueue =
        data || [];


    /*
     * La función devuelve todos los tickets
     * pertenecientes al barbero.
     *
     * Aquí identificamos el actual y los
     * que siguen esperando.
     */

    barberCurrentTicket =
        barberQueue.find(
            ticket =>
                isCurrentStatus(
                    ticket.status
                )
        ) || null;

}


/* ============================================================
   CALCULAR ESPERA
   ============================================================ */

function getWaitingTickets() {

    return barberQueue.filter(
        ticket => {

            if (
                isFinishedStatus(
                    ticket.status
                )
            ) {

                return false;

            }


            return isWaitingStatus(
                ticket.status
            );

        }
    );

}


/* ============================================================
   RENDERIZAR PANTALLA
   ============================================================ */

function renderBarberDashboard() {

    if (!barberDashboard) {
        return;
    }


    const waitingTickets =
        getWaitingTickets();


    const current =
        barberCurrentTicket;


    const next =
        waitingTickets.length > 0
            ? waitingTickets[0]
            : null;


    const waitingCount =
        waitingTickets.length;


    const mainTitle =
        current
            ? "Mi atención actual"
            : "Próximo cliente";


    const mainStatus =
        current
            ? "EN CURSO"
            : next
                ? "LISTO"
                : "LIBRE";


    const dateTime =
        formatBarberDateTime();


    barberDashboard.innerHTML = `

        <section
            class="card hero barber-profile-hero"
        >

            <div class="barber-profile-main">

                <div
                    style="flex:1 1 280px; min-width:0;"
                >

                    <!-- Identidad principal: plataforma TurnoBarber 360 -->
                    <div class="barber-platform-header">
                        <img
                            class="barber-platform-header-logo"
                            src="assets/brand/icon-maestro.png"
                            alt="Logo de TurnoBarber 360"
                        >
                        <span class="barber-platform-header-name">TURNOBARBER 360</span>
                    </div>

                    <!-- Identidad secundaria: barbería cliente -->
                    <div class="barber-client-header">
                        <div class="barber-dashboard-icon">
                            <img
                                src="${escapeBarberHtml(
                                    barberBusiness?.profileImageUrl ||
                                    "assets/brand/icon-maestro.png"
                                )}"
                                alt="${escapeBarberHtml(
                                    barberBusiness?.name ||
                                    barberProfile?.business_name ||
                                    "Mi barbería"
                                )}"
                            >
                        </div>

                        <div class="barber-client-details">
                            <h1 class="barber-business-title">
                                ${escapeBarberHtml(
                                    barberBusiness?.name ||
                                    barberProfile?.business_name ||
                                    "Mi barbería"
                                )}
                            </h1>

                            ${(barberBusiness?.city || barberProfile?.business_city)
                                ? `
                                    <p class="barber-client-city">
                                        ${escapeBarberHtml(
                                            barberBusiness?.city ||
                                            barberProfile?.business_city
                                        )}
                                    </p>
                                  `
                                : ""}
                        </div>
                    </div>

                    <div class="barber-profile-identity">
                        <div>
                            <span class="barber-profile-label">MI ESTACIÓN</span>
                            <h2>
                                ${escapeBarberHtml(
                                    barberProfile.name
                                )}
                            </h2>
                        </div>

                        <span class="barber-status-pill">
                            <span aria-hidden="true"></span>
                            ${barberProfile.active
                                ? "Activo"
                                : "Inactivo"}
                        </span>
                    </div>

                </div>

                <div class="barber-datetime-card">

                    <div
class="barber-datetime-row"
                    >
                        <span class="barber-datetime-icon" aria-hidden="true">▦</span>
                        <strong>${escapeBarberHtml(dateTime.dateText)}</strong>
                    </div>

                    <div
class="barber-datetime-row"
                    >
                        <span class="barber-datetime-icon" aria-hidden="true">◷</span>
                        <strong>${escapeBarberHtml(dateTime.timeText)}</strong>
                    </div>

                </div>

            </div>

        </section>


        <!--
            UNA SOLA SECCIÓN PRINCIPAL.
            Ocupa siempre la posición que antes tenía
            "Mi atención actual" y cambia su contenido
            según exista o no un cliente en atención.
        -->
        <section
            class="card"
            style="margin-bottom:15px;"
        >

            <div
                class="queue-header"
            >

                <h2>
                    ${mainTitle}
                </h2>

                <span
                    class="badge"
                >
                    ${mainStatus}
                </span>

            </div>


            ${
                current
                    ? `
                        <div
                            style="
                                text-align:center;
                                padding:16px 5px 5px;
                            "
                        >

                            <p
                                style="
                                    margin:0;
                                    opacity:.65;
                                    font-size:12px;
                                    font-weight:800;
                                    letter-spacing:.08em;
                                "
                            >
                                CLIENTE ACTUAL
                            </p>

                            <div
                                style="
                                    font-size:clamp(58px,15vw,92px);
                                    font-weight:900;
                                    line-height:.95;
                                    margin:10px 0 7px;
                                "
                            >
                                ${escapeBarberHtml(
                                    current.ticket_code
                                )}
                            </div>

                            <p
                                style="
                                    margin:0 0 18px;
                                    font-size:18px;
                                    font-weight:700;
                                "
                            >
                                ${escapeBarberHtml(
                                    current.service_name ||
                                    "Servicio"
                                )}
                            </p>

                            <div
                                style="
                                    display:flex;
                                    flex-direction:column;
                                    gap:9px;
                                    max-width:560px;
                                    margin:0 auto;
                                "
                            >

                                <button
                                    class="btn success big"
                                    type="button"
                                    onclick="finishBarberTicket(
                                        '${current.id}'
                                    )"
                                >
                                    Finalizar atención
                                </button>

                                <button
                                    class="btn danger"
                                    type="button"
                                    onclick="noShowBarberTicket(
                                        '${current.id}'
                                    )"
                                >
                                    No se presentó
                                </button>

                            </div>

                        </div>
                    `
                    : next
                        ? `
                            <div
                                style="
                                    text-align:center;
                                    padding:16px 5px 5px;
                                "
                            >

                                <p
                                    style="
                                        margin:0;
                                        opacity:.65;
                                        font-size:12px;
                                        font-weight:800;
                                        letter-spacing:.08em;
                                    "
                                >
                                    PRÓXIMO CLIENTE
                                </p>

                                <div
                                    style="
                                        font-size:clamp(64px,17vw,100px);
                                        font-weight:900;
                                        line-height:.95;
                                        margin:10px 0 7px;
                                    "
                                >
                                    ${escapeBarberHtml(
                                        next.ticket_code
                                    )}
                                </div>

                                <p
                                    style="
                                        margin:0 0 18px;
                                        font-size:18px;
                                        font-weight:700;
                                    "
                                >
                                    ${escapeBarberHtml(
                                        next.service_name ||
                                        "Servicio"
                                    )}
                                </p>

                                <button
                                    class="btn primary big"
                                    type="button"
                                    onclick="callNextBarber()"
                                    style="
                                        width:100%;
                                        max-width:560px;
                                    "
                                >
                                    Llamar ${escapeBarberHtml(
                                        next.ticket_code
                                    )}
                                </button>

                            </div>
                        `
                        : `
                            <div
                                class="empty"
                                style="
                                    text-align:center;
                                    padding:28px 10px 18px;
                                "
                            >

                                                                <h3
                                    style="margin:0 0 7px;"
                                >
                                    No hay clientes esperando
                                </h3>

                                <p
                                    style="margin:0;"
                                >
                                    La estación está disponible.
                                </p>

                            </div>
                        `
            }


            <div
                style="
                    display:grid;
                    grid-template-columns:repeat(2,minmax(0,1fr));
                    gap:10px;
                    margin-top:15px;
                "
            >

                <div
                    style="
                        border-radius:14px;
                        padding:13px 10px;
                        background:rgba(127,127,127,.09);
                        text-align:center;
                    "
                >

                    <strong
                        style="
                            display:block;
                            font-size:26px;
                            line-height:1;
                        "
                    >
                        ${waitingCount}
                    </strong>

                    <span
                        style="
                            display:block;
                            margin-top:5px;
                            font-size:11px;
                            opacity:.65;
                            font-weight:700;
                        "
                    >
                        ${waitingCount === 1
                            ? "cliente esperando"
                            : "clientes esperando"}
                    </span>

                </div>


                <div
                    style="
                        border-radius:14px;
                        padding:13px 10px;
                        background:rgba(127,127,127,.09);
                        text-align:center;
                    "
                >

                    <strong
                        style="
                            display:block;
                            font-size:26px;
                            line-height:1;
                        "
                    >
                        ${next
                            ? escapeBarberHtml(next.ticket_code)
                            : "—"}
                    </strong>

                    <span
                        style="
                            display:block;
                            margin-top:5px;
                            font-size:11px;
                            opacity:.65;
                            font-weight:700;
                        "
                    >
                        PRÓXIMO TURNO
                    </span>

                </div>

            </div>

        </section>


        <section
            class="card"
            style="margin-bottom:15px;"
        >

            <div
                class="queue-header"
            >

                <h2>
                    Mi cola
                </h2>

                <span
                    class="badge"
                >
                    ${waitingTickets.length}
                </span>

            </div>


            ${
                waitingTickets.length === 0
                    ? `
                        <div
                            class="empty"
                            style="text-align:center;"
                        >
                            <p>
                                No hay clientes esperando.
                            </p>
                        </div>
                      `
                    : `
                        <div
                            class="queue"
                        >

                            ${waitingTickets
                                .map(
                                    (
                                        ticket,
                                        index
                                    ) => `

                                        <div
                                            class="queue-item"
                                            style="
                                                margin-bottom:10px;
                                                align-items:center;
                                            "
                                        >

                                            <div>

                                                <strong>
                                                    ${index + 1}.
                                                    ${escapeBarberHtml(
                                                        ticket.ticket_code
                                                    )}
                                                </strong>

                                                <span>
                                                    ${escapeBarberHtml(
                                                        ticket.service_name ||
                                                        "Servicio"
                                                    )}
                                                </span>

                                            </div>


                                            ${
                                                index === 0
                                                    ? `
                                                        <span
                                                            class="badge"
                                                        >
                                                            Siguiente
                                                        </span>
                                                      `
                                                    : `
                                                        <span
                                                            style="
                                                                opacity:.7;
                                                                font-size:13px;
                                                            "
                                                        >
                                                            Esperando
                                                        </span>
                                                      `
                                            }

                                        </div>

                                    `
                                )
                                .join("")}

                        </div>
                      `
            }

        </section>


        <section
            class="card"
        >

            <div
                class="queue-header"
            >

                <h2>
                    Próxima acción
                </h2>

                <span
                    class="badge"
                >
                    ${current ? "EN CURSO" : next ? "LISTO" : "LIBRE"}
                </span>

            </div>


            <p
                style="
                    margin:0;
                    text-align:center;
                    font-weight:700;
                "
            >
                ${
                    current
                        ? `Finaliza la atención de <strong>${escapeBarberHtml(current.ticket_code)}</strong> para continuar con el siguiente cliente.`
                        : next
                            ? `Llama a <strong>${escapeBarberHtml(next.ticket_code)}</strong> para iniciar la atención.`
                            : "No hay turnos pendientes. Esperando nuevos clientes."
                }
            </p>

        </section>


        <button
            class="btn"
            type="button"
            onclick="barberLogout()"
            style="
                width:100%;
                margin-bottom:15px;
                min-height:54px;
                font-size:17px;
            "
        >
            Salir
        </button>


        <p
            id="barberDashboardMessage"
            style="
                text-align:center;
                margin-top:15px;
            "
        ></p>

    `;

}

/* ============================================================
   ESTADO DE CARGA
   ============================================================ */

function showBarberLoading(
    message
) {

    if (!barberDashboard) {

        return;

    }


    barberDashboard.innerHTML = `

        <section
            class="card hero"
            style="text-align:center;"
        >

            <div
                style="
                    font-size:42px;
                    margin-bottom:10px;
                "
            >
                🔄
            </div>

            <h2>
                ${escapeBarberHtml(
                    message
                )}
            </h2>

        </section>

    `;

}


/* ============================================================
   ERROR
   ============================================================ */

function showBarberDashboardError(
    message
) {

    if (!barberDashboard) {

        return;

    }


    barberDashboard.innerHTML = `

        <section
            class="card hero"
            style="text-align:center;"
        >

            <div
                style="
                    font-size:42px;
                    margin-bottom:10px;
                "
            >
                ⚠️
            </div>

            <h2>
                No se pudo cargar tu pantalla
            </h2>

            <p>
                ${escapeBarberHtml(
                    message
                )}
            </p>

            <button
                class="btn primary"
                type="button"
                onclick="loadBarberDashboard()"
            >
                🔄 Reintentar
            </button>

            <button
                class="btn"
                type="button"
                onclick="barberLogout()"
                style="margin-top:8px;"
            >
                🚪 Cerrar sesión
            </button>

        </section>

    `;

}


/* ============================================================
   CARGAR TODO
   ============================================================ */

async function loadBarberDashboard(
    showLoading = true
) {

    if (barberLoading) {

        return;

    }


    barberLoading = true;


    try {

        const session =
            await getBarberSession();


        if (!session) {

            if (typeof window.showBarberCodeLogin === "function") {

                window.showBarberCodeLogin();

            }

            return;

        }


        if (showLoading) {
            showBarberLoading(
                "Cargando tu cola..."
            );
        }


        barberProfile =
            await loadBarberProfile();


        if (!barberProfile) {

            throw new Error(
                "Esta cuenta todavía no está vinculada a un barbero. Debes aceptar primero la invitación del administrador."
            );

        }


        if (!barberProfile.active) {

            throw new Error(
                "Tu acceso de barbero está inactivo. Contacta al administrador."
            );

        }


        barberBusiness =
            await loadBarberBusiness();


        if (barberBusiness?.timezone) {

            barberBusinessTimezone =
                barberBusiness.timezone;

        } else if (barberBusiness?.id) {

            try {

                const {
                    data: timezoneData,
                    error: timezoneError
                } =
                    await barberClient.rpc(
                        "get_business_timezone",
                        {
                            p_business_id:
                                barberBusiness.id
                        }
                    );

                if (!timezoneError && timezoneData) {

                    barberBusinessTimezone =
                        Array.isArray(timezoneData)
                            ? timezoneData[0]?.timezone || timezoneData[0]
                            : timezoneData;

                }

            } catch (error) {

                console.warn(
                    "NO SE PUDO OBTENER LA ZONA HORARIA DE LA BARBERÍA:",
                    error
                );

            }

        }


        await loadBarberQueue();


        renderBarberDashboard();


    } catch (error) {

        console.error(
            "ERROR PANTALLA BARBERO:",
            error
        );


        showBarberDashboardError(
            error.message
        );

    } finally {

        barberLoading = false;

    }

}


/* ============================================================
   LLAMAR SIGUIENTE
   ============================================================ */

async function callNextBarber() {

    if (barberActionRunning) {

        return;

    }


    barberActionRunning = true;


    try {

        const {
            data,
            error
        } =
            await barberClient.rpc(
                "barber_call_next"
            );


        if (error) {

            throw error;

        }


        if (
            !data ||
            data.length === 0
        ) {

            alert(
                "No hay un turno disponible para llamar."
            );

            return;

        }


        await loadBarberDashboard(
            false
        );

    } catch (error) {

        console.error(
            "ERROR LLAMANDO SIGUIENTE:",
            error
        );

        alert(
            error.message
        );

    } finally {

        barberActionRunning = false;

    }

}


/* ============================================================
   FINALIZAR TURNO
   ============================================================ */

async function finishBarberTicket(
    ticketId
) {

    if (
        !ticketId ||
        barberActionRunning
    ) {

        return;

    }


    const confirmed =
        confirm(
            "¿Finalizar la atención de este turno?"
        );


    if (!confirmed) {

        return;

    }


    barberActionRunning = true;


    try {

        const {
            data,
            error
        } =
            await barberClient.rpc(
                "barber_finish_ticket",
                {
                    p_ticket_id:
                        ticketId
                }
            );


        if (error) {

            throw error;

        }


        if (data !== true) {

            throw new Error(
                "No se pudo finalizar el turno."
            );

        }


        await loadBarberDashboard(
            false
        );

    } catch (error) {

        console.error(
            "ERROR FINALIZANDO TURNO:",
            error
        );

        alert(
            error.message
        );

    } finally {

        barberActionRunning = false;

    }

}


/* ============================================================
   NO SE PRESENTÓ
   ============================================================ */

async function noShowBarberTicket(
    ticketId
) {

    if (
        !ticketId ||
        barberActionRunning
    ) {

        return;

    }


    const confirmed =
        confirm(
            "¿Marcar este turno como no presentado?"
        );


    if (!confirmed) {

        return;

    }


    barberActionRunning = true;


    try {

        const {
            data,
            error
        } =
            await barberClient.rpc(
                "barber_no_show_ticket",
                {
                    p_ticket_id:
                        ticketId
                }
            );


        if (error) {

            throw error;

        }


        if (data !== true) {

            throw new Error(
                "No se pudo marcar el turno como no presentado."
            );

        }


        await loadBarberDashboard(
            false
        );

    } catch (error) {

        console.error(
            "ERROR NO PRESENTADO:",
            error
        );

        alert(
            error.message
        );

    } finally {

        barberActionRunning = false;

    }

}


/* ============================================================
   CERRAR SESIÓN
   ============================================================ */

async function barberLogout() {

    try {

        if (barberRefreshTimer) {

            clearInterval(
                barberRefreshTimer
            );

            barberRefreshTimer = null;

        }


        sessionStorage.removeItem(
            "turnobarber_barber_id"
        );


        await barberClient.auth.signOut();


    } catch (error) {

        console.error(
            "ERROR CERRANDO SESIÓN BARBERO:",
            error
        );

    }


    window.location.href =
        "barbero.html";

}


/* ============================================================
   ACTUALIZACIÓN AUTOMÁTICA
   ============================================================ */

function startBarberAutoRefresh() {

    if (barberRefreshTimer) {

        clearInterval(
            barberRefreshTimer
        );

    }


    barberRefreshTimer =
        setInterval(
            async function() {

                if (
                    document.hidden ||
                    barberActionRunning
                ) {

                    return;

                }


                try {

                    barberProfile =
                        await loadBarberProfile();


                    if (!barberProfile) {

                        return;

                    }


                    if (!barberBusiness) {

                        barberBusiness =
                            await loadBarberBusiness();

                    }


                    if (barberBusiness?.timezone) {

                        barberBusinessTimezone =
                            barberBusiness.timezone;

                    }


                    await loadBarberQueue();

                    renderBarberDashboard();

                } catch (error) {

                    console.error(
                        "ERROR ACTUALIZANDO COLA:",
                        error
                    );

                }

            },
            5000
        );

}


/* ============================================================
   INICIO
   ============================================================ */

async function startBarberModule() {

    if (barberModuleStarting || barberModuleInitialized) {
        return;
    }

    if (!barberDashboard) {

        return;

    }


    const params =
        new URLSearchParams(
            window.location.search
        );


    const mode =
        params.get(
            "mode"
        );


    /*
     * Solo mostramos el panel cuando la URL
     * indica explícitamente que ya se completó
     * el acceso.
     */

    if (
        mode !==
        "dashboard"
    ) {

        return;

    }


    /*
     * Ocultamos la puerta de entrada
     * y mostramos el módulo de trabajo.
     */

    const accessApp =
        document.getElementById(
            "barberApp"
        );


    if (accessApp) {

        accessApp.style.setProperty(
            "display",
            "none",
            "important"
        );

    }


    barberDashboard.style.setProperty(
        "display",
        "block",
        "important"
    );

    barberModuleStarting = true;

    try {
        await loadBarberDashboard();

        if (barberProfile) {
            barberModuleInitialized = true;
            startBarberAutoRefresh();
        }
    } finally {
        barberModuleStarting = false;
    }

}


/* ============================================================
   AUTH STATE
   ============================================================ */

barberClient.auth.onAuthStateChange(
    function(
        event,
        session
    ) {

        console.log(
            "BARBER DASHBOARD AUTH:",
            event
        );


        if (
            event ===
                "SIGNED_OUT"
        ) {

            if (
                barberRefreshTimer
            ) {

                clearInterval(
                    barberRefreshTimer
                );

                barberRefreshTimer =
                    null;

            }

            barberModuleInitialized = false;
            barberModuleStarting = false;

            /*
             * Si la sesión técnica del barbero realmente termina,
             * no mostramos un error de "cuenta no vinculada".
             * Volvemos directamente al acceso por PIN.
             */
            const params =
                new URLSearchParams(
                    window.location.search
                );

            if (
                params.get("mode") ===
                    "dashboard" &&
                typeof window.showBarberCodeLogin ===
                    "function"
            ) {

                window.showBarberCodeLogin(
                    "Tu sesión terminó. Ingresa nuevamente con tu código."
                );

            }

            return;

        }


        if (
            event === "SIGNED_IN" &&
            session &&
            !barberModuleInitialized &&
            !barberModuleStarting &&
            window.location.search.includes(
                "mode=dashboard"
            )
        ) {

            startBarberModule();

        }

    }
);


/* ============================================================
   ARRANQUE
   ============================================================ */

document.addEventListener(
    "DOMContentLoaded",
    function() {

        startBarberModule();

    }
);

/* TURNOBARBER - MI PANTALLA DE BARBERO */

let barberProfile = null;
let barberQueue = [];
let currentBarberTicket = null;
let loadingDashboard = false;
let runningAction = false;
let refreshTimer = null;

const dashboard =
    document.getElementById(
        "barberDashboard"
    );


function escapeHtml(value) {

    return String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");

}


function norm(value) {

    return String(value ?? "")
        .trim()
        .toLowerCase();

}


function isWaiting(value) {

    return [
        "waiting",
        "pending",
        "queued",
        "queue",
        "en_espera",
        "esperando",
        "pendiente"
    ].includes(
        norm(value)
    );

}


function isServing(value) {

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
    ].includes(
        norm(value)
    );

}


async function getSession() {

    const {
        data,
        error
    } =
        await client.auth.getSession();

    if (error) {
        throw error;
    }

    return data?.session || null;

}


async function loadProfile() {

    const {
        data,
        error
    } =
        await client.rpc(
            "get_my_barber"
        );

    if (error) {
        throw error;
    }

    return data?.[0] || null;

}


async function loadQueue() {

    const {
        data,
        error
    } =
        await client.rpc(
            "barber_my_queue"
        );

    if (error) {
        throw error;
    }

    barberQueue =
        data || [];

    currentBarberTicket =
        barberQueue.find(
            ticket =>
                isServing(
                    ticket.status
                )
        ) || null;

}


function waitingTickets() {

    return barberQueue.filter(
        ticket =>
            isWaiting(
                ticket.status
            )
    );

}


function renderDashboard(
    message = ""
) {

    if (
        !dashboard ||
        !barberProfile
    ) {
        return;
    }

    const waiting =
        waitingTickets();

    const next =
        waiting[0] || null;

    const current =
        currentBarberTicket;


    dashboard.innerHTML = `

        <section
            class="card hero"
            style="margin-bottom:15px;"
        >

            <div
                style="
                    display:flex;
                    justify-content:space-between;
                    align-items:center;
                    gap:12px;
                    flex-wrap:wrap;
                "
            >

                <div>

                    <h1
                        style="
                            margin-top:0;
                            margin-bottom:5px;
                        "
                    >
                        💈 Mi pantalla de barbero
                    </h1>

                    <h2
                        style="
                            margin:0 0 5px;
                        "
                    >
                        ${escapeHtml(
                            barberProfile.name
                        )}
                    </h2>

                    <p
                        style="
                            margin:0;
                            opacity:.75;
                        "
                    >
                        🟢 Barbero activo
                    </p>

                </div>

                <button
                    class="btn"
                    type="button"
                    onclick="barberLogout()"
                >
                    🚪 Salir
                </button>

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
                    🎟️ AHORA ATENDIENDO
                </h2>

                <span
                    class="badge"
                >
                    ${waiting.length}
                    esperando
                </span>

            </div>


            ${
                current
                    ? `

                        <div
                            style="
                                text-align:center;
                                padding:10px 0 5px;
                            "
                        >

                            <p
                                style="
                                    margin:0;
                                    opacity:.7;
                                "
                            >
                                TURNO ACTUAL
                            </p>


                            <div
                                style="
                                    font-size:64px;
                                    font-weight:800;
                                    line-height:1;
                                    margin:12px 0;
                                "
                            >
                                ${escapeHtml(
                                    current.ticket_code
                                )}
                            </div>


                            <h3
                                style="
                                    margin:5px 0 15px;
                                "
                            >
                                ${escapeHtml(
                                    current.service_name ||
                                    "Servicio"
                                )}
                            </h3>


                            <div
                                style="
                                    display:flex;
                                    gap:8px;
                                    justify-content:center;
                                    flex-wrap:wrap;
                                "
                            >

                                <button
                                    class="btn success"
                                    type="button"
                                    onclick="finishTicket(
                                        '${current.id}'
                                    )"
                                >
                                    ✅ Finalizar atención
                                </button>


                                <button
                                    class="btn danger"
                                    type="button"
                                    onclick="noShowTicket(
                                        '${current.id}'
                                    )"
                                >
                                    🚫 No se presentó
                                </button>

                            </div>

                        </div>

                    `
                    : `

                        <div
                            class="empty"
                            style="text-align:center;"
                        >

                            <div
                                style="font-size:48px;"
                            >
                                🪑
                            </div>

                            <h3>
                                No estás atendiendo un turno
                            </h3>

                            <p>
                                ${
                                    next
                                        ? `
                                            El siguiente es
                                            <strong>
                                                ${escapeHtml(
                                                    next.ticket_code
                                                )}
                                            </strong>
                                          `
                                        : `
                                            No tienes clientes
                                            esperando.
                                          `
                                }
                            </p>

                        </div>

                    `
            }

        </section>


        <section
            class="card"
            style="margin-bottom:15px;"
        >

            <div
                class="queue-header"
            >

                <h2>
                    📋 MI COLA
                </h2>

                <span
                    class="badge"
                >
                    ${waiting.length}
                </span>

            </div>


            ${
                waiting.length
                    ? `

                        <div
                            class="queue"
                        >

                            ${waiting
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
                                                    ${escapeHtml(
                                                        ticket.ticket_code
                                                    )}
                                                </strong>

                                                <span>
                                                    ${escapeHtml(
                                                        ticket.service_name ||
                                                        "Servicio"
                                                    )}
                                                </span>

                                            </div>


                                            ${
                                                index === 0 &&
                                                !current
                                                    ? `
                                                        <span
                                                            class="badge"
                                                        >
                                                            ⏭️ Siguiente
                                                        </span>
                                                      `
                                                    : `
                                                        <span
                                                            style="
                                                                opacity:.65;
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
                    : `

                        <div
                            class="empty"
                            style="text-align:center;"
                        >

                            <p>
                                🟢 No hay clientes esperando.
                            </p>

                        </div>

                    `
            }

        </section>


        <section
            class="card"
        >

            <h2>
                📢 Próxima acción
            </h2>


            ${
                current
                    ? `

                        <p>
                            Estás atendiendo
                            <strong>
                                ${escapeHtml(
                                    current.ticket_code
                                )}
                            </strong>.

                            Finaliza la atención
                            para continuar.
                        </p>

                    `
                    : next
                        ? `

                            <p>
                                Próximo cliente:

                                <strong>
                                    ${escapeHtml(
                                        next.ticket_code
                                    )}
                                </strong>

                                ·

                                ${escapeHtml(
                                    next.service_name ||
                                    "Servicio"
                                )}
                            </p>


                            <button
                                class="btn primary big"
                                type="button"
                                onclick="callNext()"
                            >
                                📢 Llamar
                                ${escapeHtml(
                                    next.ticket_code
                                )}
                            </button>

                          `
                        : `

                            <p>
                                🟢 Todo al día.
                                No hay turnos pendientes.
                            </p>

                          `
            }


            <p
                id="barberDashboardMessage"
                style="margin-top:12px;"
            >
                ${escapeHtml(
                    message
                )}
            </p>

        </section>

    `;

}


function showError(
    message
) {

    if (!dashboard) {
        return;
    }

    dashboard.innerHTML = `

        <section
            class="card hero"
            style="text-align:center;"
        >

            <div
                style="font-size:45px;"
            >
                ⚠️
            </div>

            <h2>
                No se pudo cargar tu pantalla
            </h2>

            <p>
                ${escapeHtml(
                    message
                )}
            </p>


            <button
                class="btn primary"
                type="button"
                onclick="loadDashboard()"
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


async function loadDashboard() {

    if (
        !dashboard ||
        loadingDashboard
    ) {
        return;
    }

    loadingDashboard =
        true;


    try {

        const session =
            await getSession();


        if (!session) {

            window.location.href =
                "login.html";

            return;

        }


        dashboard.innerHTML = `

            <section
                class="card hero"
                style="text-align:center;"
            >

                <h2>
                    🔄 Cargando tu cola...
                </h2>

            </section>

        `;


        barberProfile =
            await loadProfile();


        if (!barberProfile) {

            throw new Error(
                "Tu cuenta todavía no está vinculada a un barbero. Debes aceptar la invitación del administrador."
            );

        }


        if (
            barberProfile.active ===
            false
        ) {

            throw new Error(
                "Tu acceso de barbero está inactivo. Contacta al administrador."
            );

        }


        await loadQueue();

        renderDashboard();


    } catch (error) {

        console.error(
            "ERROR MODULO BARBERO:",
            error
        );

        showError(
            error.message
        );

    } finally {

        loadingDashboard =
            false;

    }

}


async function callNext() {

    if (runningAction) {
        return;
    }

    runningAction =
        true;


    try {

        const {
            data,
            error
        } =
            await client.rpc(
                "barber_call_next"
            );


        if (error) {
            throw error;
        }


        if (
            !data ||
            !data.length
        ) {

            alert(
                "No hay un turno disponible para llamar."
            );

            return;

        }


        await loadDashboard();


    } catch (error) {

        console.error(
            "ERROR LLAMANDO TURNO:",
            error
        );

        alert(
            error.message
        );

    } finally {

        runningAction =
            false;

    }

}


async function finishTicket(
    ticketId
) {

    if (
        !ticketId ||
        runningAction
    ) {
        return;
    }


    if (
        !confirm(
            "¿Finalizar la atención de este turno?"
        )
    ) {
        return;
    }


    runningAction =
        true;


    try {

        const {
            data,
            error
        } =
            await client.rpc(
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


        await loadDashboard();


    } catch (error) {

        console.error(
            "ERROR FINALIZANDO TURNO:",
            error
        );

        alert(
            error.message
        );

    } finally {

        runningAction =
            false;

    }

}


async function noShowTicket(
    ticketId
) {

    if (
        !ticketId ||
        runningAction
    ) {
        return;
    }


    if (
        !confirm(
            "¿Marcar este turno como no presentado?"
        )
    ) {
        return;
    }


    runningAction =
        true;


    try {

        const {
            data,
            error
        } =
            await client.rpc(
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


        await loadDashboard();


    } catch (error) {

        console.error(
            "ERROR NO PRESENTADO:",
            error
        );

        alert(
            error.message
        );

    } finally {

        runningAction =
            false;

    }

}


async function barberLogout() {

    if (refreshTimer) {

        clearInterval(
            refreshTimer
        );

        refreshTimer =
            null;

    }


    sessionStorage.removeItem(
        "turnobarber_barber_id"
    );


    try {

        await client.auth.signOut();

    } catch (error) {

        console.error(
            "ERROR CERRANDO SESION:",
            error
        );

    }


    window.location.href =
        "login.html";

}


function startAutoRefresh() {

    if (refreshTimer) {

        clearInterval(
            refreshTimer
        );

    }


    refreshTimer =
        setInterval(
            async () => {

                if (
                    document.hidden ||
                    runningAction ||
                    !barberProfile
                ) {
                    return;
                }


                try {

                    await loadQueue();

                    renderDashboard();

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


async function startBarberModule() {

    const params =
        new URLSearchParams(
            window.location.search
        );


    if (
        params.get(
            "mode"
        ) !== "dashboard" ||
        !dashboard
    ) {
        return;
    }


    const accessApp =
        document.getElementById(
            "barberApp"
        );


    if (accessApp) {

        accessApp.style.display =
            "none";

    }


    dashboard.style.display =
        "block";


    await loadDashboard();

    startAutoRefresh();

}


client.auth.onAuthStateChange(
    (
        event,
        session
    ) => {

        console.log(
            "BARBER AUTH:",
            event
        );


        if (
            event ===
            "SIGNED_OUT"
        ) {

            if (refreshTimer) {

                clearInterval(
                    refreshTimer
                );

                refreshTimer =
                    null;

            }

        }


        if (
            session &&
            new URLSearchParams(
                window.location.search
            ).get(
                "mode"
            ) ===
            "dashboard"
        ) {

            startBarberModule();

        }

    }
);


document.addEventListener(
    "DOMContentLoaded",
    startBarberModule
);

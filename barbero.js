/* ==========================================================
   TURNOBARBER - MI PANTALLA DE BARBERO

   Control de acceso:
   - Solo permite trabajar a un barbero activo.
   - Verifica periódicamente que el acceso siga activo.
   - Si el administrador desactiva al barbero,
     la estación se bloquea automáticamente.
   - La lógica de Supabase y los RPC existentes se mantienen.
========================================================== */


let barberProfile = null;
let barberQueue = [];
let currentBarberTicket = null;

let loadingDashboard = false;
let runningAction = false;
let refreshTimer = null;

let accessBlocked = false;


/* ==========================================================
   ELEMENTO PRINCIPAL
========================================================== */


const dashboard =
    document.getElementById(
        "barberDashboard"
    );


/* ==========================================================
   UTILIDADES
========================================================== */


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


/* ==========================================================
   SESIÓN
========================================================== */


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


/* ==========================================================
   PERFIL DEL BARBERO
========================================================== */


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


/* ==========================================================
   VERIFICAR ACCESO

   IMPORTANTE:
   get_my_barber() solamente devuelve un barbero
   cuando está activo.

   Por eso, si el administrador lo desactiva,
   esta función deja de encontrarlo.
========================================================== */


async function verifyBarberAccess() {

    const profile =
        await loadProfile();


    if (!profile) {

        accessBlocked =
            true;

        barberProfile =
            null;

        stopAutoRefresh();

        renderAccessBlocked();

        return false;

    }


    if (
        profile.active ===
        false
    ) {

        accessBlocked =
            true;

        barberProfile =
            null;

        stopAutoRefresh();

        renderAccessBlocked();

        return false;

    }


    accessBlocked =
        false;

    barberProfile =
        profile;


    return true;

}


/* ==========================================================
   COLA
========================================================== */


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


/* ==========================================================
   TURNOS EN ESPERA
========================================================== */


function waitingTickets() {

    return barberQueue.filter(
        ticket =>
            isWaiting(
                ticket.status
            )
    );

}


/* ==========================================================
   PANTALLA DE ACCESO BLOQUEADO
========================================================== */


function renderAccessBlocked() {

    if (!dashboard) {
        return;
    }


    dashboard.innerHTML = `

        <section
            class="card hero"
            style="
                text-align:center;
                padding:35px 20px;
                max-width:600px;
                margin:30px auto;
            "
        >

            <div
                style="
                    font-size:58px;
                    margin-bottom:10px;
                "
            >
                🔒
            </div>


            <h2
                style="
                    margin-bottom:10px;
                "
            >
                Acceso bloqueado
            </h2>


            <p
                style="
                    font-size:17px;
                    line-height:1.5;
                "
            >
                Tu acceso como barbero está
                actualmente inactivo.
            </p>


            <p
                style="
                    opacity:.7;
                    line-height:1.5;
                "
            >
                El administrador de la barbería
                desactivó este acceso o tu cuenta
                ya no está vinculada a un barbero activo.
            </p>


            <button
                class="btn primary"
                type="button"
                onclick="location.reload()"
                style="
                    width:100%;
                    max-width:400px;
                    margin-top:15px;
                    min-height:50px;
                "
            >
                🔄 Verificar nuevamente
            </button>


            <button
                class="btn"
                type="button"
                onclick="barberLogout()"
                style="
                    width:100%;
                    max-width:400px;
                    margin-top:10px;
                    min-height:48px;
                "
            >
                🚪 Cerrar sesión
            </button>


        </section>

    `;

}


/* ==========================================================
   DASHBOARD
========================================================== */


function renderDashboard(
    message = ""
) {

    if (
        !dashboard ||
        !barberProfile ||
        accessBlocked
    ) {
        return;
    }


    const waiting =
        waitingTickets();


    const next =
        waiting[0] || null;


    const current =
        currentBarberTicket;


    const waitingCount =
        waiting.length;


    const queueLabel =
        waitingCount === 1
            ? "cliente esperando"
            : "clientes esperando";


    const statusTitle =
        current
            ? "ATENDIENDO"
            : next
                ? "LISTO PARA ATENDER"
                : "DISPONIBLE";


    const statusIcon =
        current
            ? "🔵"
            : "🟢";


    const statusClass =
        current
            ? "tb-status-serving"
            : "tb-status-ready";


    const nextAction =
        current
            ? "Finaliza la atención actual"
            : next
                ? `Llama a ${escapeHtml(next.ticket_code)}`
                : "Esperando nuevos clientes";


    dashboard.innerHTML = `

        <style>

            .tb-dashboard {
                display:flex;
                flex-direction:column;
                gap:14px;
                font-family:inherit;
            }


            .tb-top {
                display:flex;
                justify-content:space-between;
                align-items:center;
                gap:12px;
                flex-wrap:wrap;
                padding:16px 18px;
            }


            .tb-brand {
                display:flex;
                align-items:center;
                gap:12px;
                min-width:0;
            }


            .tb-brand-icon {
                width:48px;
                height:48px;
                border-radius:14px;
                display:flex;
                align-items:center;
                justify-content:center;
                font-size:27px;
                background:rgba(127,127,127,.12);
                flex:0 0 auto;
            }


            .tb-brand h1 {
                margin:0;
                font-size:21px;
                line-height:1.1;
            }


            .tb-brand p {
                margin:5px 0 0;
                opacity:.68;
                font-size:14px;
            }


            .tb-status {
                display:inline-flex;
                align-items:center;
                gap:7px;
                border-radius:999px;
                padding:8px 12px;
                font-size:12px;
                font-weight:800;
                letter-spacing:.04em;
                white-space:nowrap;
                background:rgba(34,197,94,.12);
            }


            .tb-status-serving {
                background:rgba(59,130,246,.14);
            }


            .tb-main-card {
                padding:22px 18px 20px;
                text-align:center;
                overflow:hidden;
            }


            .tb-section-label {
                margin:0;
                font-size:12px;
                font-weight:800;
                letter-spacing:.09em;
                opacity:.62;
            }


            .tb-current-code {
                font-size:clamp(70px,18vw,112px);
                line-height:.95;
                font-weight:900;
                letter-spacing:-.04em;
                margin:13px 0 7px;
            }


            .tb-service {
                font-size:20px;
                font-weight:750;
                margin:0 0 18px;
            }


            .tb-empty-icon {
                width:150px;
                margin:4px auto 10px;
                line-height:0;
            }

            .tb-barber-chair {
                display:block;
                width:100%;
                height:auto;
            }


            .tb-empty-title {
                margin:0;
                font-size:22px;
            }


            .tb-empty-text {
                margin:7px auto 0;
                max-width:440px;
                opacity:.68;
            }


            .tb-stats {
                display:grid;
                grid-template-columns:
                    repeat(2,minmax(0,1fr));
                gap:10px;
                margin-top:15px;
            }


            .tb-stat {
                border-radius:14px;
                padding:13px 10px;
                background:rgba(127,127,127,.09);
            }


            .tb-stat-number {
                display:block;
                font-size:26px;
                font-weight:900;
                line-height:1;
            }


            .tb-stat-label {
                display:block;
                margin-top:5px;
                font-size:11px;
                opacity:.65;
                font-weight:700;
            }


            .tb-actions {
                display:flex;
                flex-direction:column;
                gap:9px;
                max-width:520px;
                margin:0 auto;
            }


            .tb-action-main {
                min-height:58px;
                font-size:18px !important;
                font-weight:850 !important;
            }


            .tb-action-secondary {
                min-height:48px;
            }


            .tb-next {
                padding:16px 18px;
            }


            .tb-next-head {
                display:flex;
                justify-content:space-between;
                align-items:center;
                gap:10px;
                margin-bottom:12px;
            }


            .tb-next-title {
                margin:0;
                font-size:17px;
            }


            .tb-next-ticket {
                display:flex;
                align-items:center;
                justify-content:space-between;
                gap:12px;
                padding:15px;
                border-radius:14px;
                background:rgba(127,127,127,.09);
            }


            .tb-next-code {
                font-size:29px;
                font-weight:900;
                line-height:1;
            }


            .tb-next-service {
                margin-top:5px;
                font-size:13px;
                opacity:.68;
            }


            .tb-queue-list {
                display:flex;
                flex-direction:column;
                gap:8px;
            }


            .tb-queue-item {
                display:flex;
                align-items:center;
                justify-content:space-between;
                gap:12px;
                padding:12px 13px;
                border-radius:12px;
                background:rgba(127,127,127,.075);
            }


            .tb-queue-position {
                width:30px;
                height:30px;
                border-radius:9px;
                display:flex;
                align-items:center;
                justify-content:center;
                font-weight:850;
                background:rgba(127,127,127,.13);
                flex:0 0 auto;
            }


            .tb-queue-info {
                display:flex;
                align-items:center;
                gap:10px;
                min-width:0;
                flex:1;
            }


            .tb-queue-code {
                font-weight:850;
            }


            .tb-queue-service {
                margin-top:3px;
                font-size:12px;
                opacity:.65;
            }


            .tb-next-badge {
                border-radius:999px;
                padding:6px 9px;
                font-size:11px;
                font-weight:800;
                background:rgba(34,197,94,.12);
                white-space:nowrap;
            }


            .tb-message {
                text-align:center;
                min-height:18px;
                margin:0;
            }


            .tb-footer {
                text-align:center;
                font-size:11px;
                opacity:.45;
                padding:3px 0 0;
            }


            @media (max-width:480px) {

                .tb-top {
                    padding:14px;
                }


                .tb-brand h1 {
                    font-size:18px;
                }


                .tb-main-card {
                    padding:20px 14px 17px;
                }


                .tb-service {
                    font-size:18px;
                }


                .tb-next {
                    padding:14px;
                }


                .tb-queue-item {
                    padding:11px;
                }

            }

        </style>


        <div class="tb-dashboard">


            <section class="card tb-top">

                <div class="tb-brand">

                    <div class="tb-brand-icon">
                        💈
                    </div>


                    <div>

                        <h1>
                            ${escapeHtml(
                                barberProfile.name
                            )}
                        </h1>


                        <p>
                            Mi estación de trabajo
                        </p>

                    </div>

                </div>


                <div
                    class="tb-status ${statusClass}"
                >

                    ${statusIcon}

                    ${statusTitle}

                </div>

            </section>


            <section class="card tb-main-card">


                ${
                    current
                        ? `

                            <p class="tb-section-label">
                                CLIENTE ACTUAL
                            </p>


                            <div class="tb-current-code">
                                ${escapeHtml(
                                    current.ticket_code
                                )}
                            </div>


                            <p class="tb-service">
                                ${escapeHtml(
                                    current.service_name ||
                                    "Servicio"
                                )}
                            </p>


                            <div class="tb-actions">


                                <button
                                    class="btn success tb-action-main"
                                    type="button"
                                    onclick="finishTicket('${current.id}')"
                                    ${runningAction ? "disabled" : ""}
                                >
                                    ✅ FINALIZAR ATENCIÓN
                                </button>


                                <button
                                    class="btn danger tb-action-secondary"
                                    type="button"
                                    onclick="noShowTicket('${current.id}')"
                                    ${runningAction ? "disabled" : ""}
                                >
                                    🚫 No se presentó
                                </button>


                            </div>

                          `

                        : next

                            ? `

                                <p class="tb-section-label">
                                    PRÓXIMO CLIENTE
                                </p>


                                <div class="tb-current-code">
                                    ${escapeHtml(
                                        next.ticket_code
                                    )}
                                </div>


                                <p class="tb-service">
                                    ${escapeHtml(
                                        next.service_name ||
                                        "Servicio"
                                    )}
                                </p>


                                <div class="tb-actions">


                                    <button
                                        class="btn primary tb-action-main"
                                        type="button"
                                        onclick="callNext()"
                                        ${runningAction ? "disabled" : ""}
                                    >
                                        📢 LLAMAR ${escapeHtml(
                                            next.ticket_code
                                        )}
                                    </button>


                                </div>

                              `

                            : `

                                <div class="tb-empty-icon">
                                    <svg
                                        class="tb-barber-chair"
                                        viewBox="0 0 220 132"
                                        role="img"
                                        aria-label="Silla de barbería disponible"
                                    >
                                        <path d="M68 57V37c0-12 10-22 22-22h39c12 0 22 10 22 22v20" fill="#dbeafe" stroke="#335b88" stroke-width="6" stroke-linejoin="round"/>
                                        <path d="M59 55h104c8 0 14 6 14 14v13H45V69c0-8 6-14 14-14Z" fill="#315d8d" stroke="#203a57" stroke-width="6" stroke-linejoin="round"/>
                                        <path d="M60 84h102l-13 18H73L60 84Z" fill="#1e3854"/>
                                        <path d="M110 102v15" stroke="#9fb4c9" stroke-width="7" stroke-linecap="round"/>
                                        <path d="M74 120h72" stroke="#b8c7d6" stroke-width="8" stroke-linecap="round"/>
                                        <path d="M47 82l-17 16m143-16 17 16" stroke="#203a57" stroke-width="6" stroke-linecap="round"/>
                                        <circle cx="28" cy="100" r="7" fill="#60a5fa"/><circle cx="192" cy="100" r="7" fill="#60a5fa"/>
                                    </svg>
                                </div>


                                <h2 class="tb-empty-title">
                                    Estás disponible
                                </h2>


                                <p class="tb-empty-text">
                                    No tienes clientes esperando.
                                    Cuando llegue un turno aparecerá aquí.
                                </p>

                              `

                }


                <div class="tb-stats">


                    <div class="tb-stat">

                        <span class="tb-stat-number">
                            ${waitingCount}
                        </span>


                        <span class="tb-stat-label">
                            ${queueLabel}
                        </span>

                    </div>


                    <div class="tb-stat">

                        <span class="tb-stat-number">

                            ${
                                next
                                    ? escapeHtml(
                                        next.ticket_code
                                    )
                                    : "—"
                            }

                        </span>


                        <span class="tb-stat-label">
                            PRÓXIMO TURNO
                        </span>

                    </div>


                </div>


            </section>


            ${
                waiting.length
                    ? `

                        <section class="card tb-next">

                            <div class="tb-next-head">

                                <h2 class="tb-next-title">
                                    📋 Mi cola
                                </h2>


                                <span class="badge">
                                    ${waitingCount}
                                </span>

                            </div>


                            <div class="tb-queue-list">

                                ${waiting
                                    .map(
                                        (
                                            ticket,
                                            index
                                        ) => `

                                            <div
                                                class="tb-queue-item"
                                            >

                                                <div
                                                    class="tb-queue-info"
                                                >

                                                    <span
                                                        class="tb-queue-position"
                                                    >
                                                        ${index + 1}
                                                    </span>


                                                    <div>

                                                        <div
                                                            class="tb-queue-code"
                                                        >
                                                            ${escapeHtml(
                                                                ticket.ticket_code
                                                            )}
                                                        </div>


                                                        <div
                                                            class="tb-queue-service"
                                                        >
                                                            ${escapeHtml(
                                                                ticket.service_name ||
                                                                "Servicio"
                                                            )}
                                                        </div>

                                                    </div>

                                                </div>


                                                ${
                                                    index === 0
                                                        ? `
                                                            <span
                                                                class="tb-next-badge"
                                                            >
                                                                ⏭️ SIGUIENTE
                                                            </span>
                                                          `
                                                        : `
                                                            <span
                                                                style="
                                                                    font-size:11px;
                                                                    opacity:.5;
                                                                "
                                                            >
                                                                En espera
                                                            </span>
                                                          `
                                                }

                                            </div>

                                        `
                                    )
                                    .join("")}

                            </div>


                        </section>

                      `
                    : ""
            }


            <section class="card tb-next">


                <div class="tb-next-head">

                    <h2 class="tb-next-title">
                        💡 Próxima acción
                    </h2>


                    <span class="badge">
                        ${current ? "EN CURSO" : "LISTO"}
                    </span>

                </div>


                <p
                    style="
                        margin:0;
                        text-align:center;
                        font-weight:700;
                    "
                >
                    ${escapeHtml(
                        nextAction
                    )}
                </p>


                ${
                    !current && next
                        ? `

                            <button
                                class="btn primary"
                                type="button"
                                onclick="callNext()"
                                ${runningAction ? "disabled" : ""}
                                style="
                                    width:100%;
                                    margin-top:12px;
                                    min-height:50px;
                                    font-weight:800;
                                "
                            >
                                📢 Llamar ${escapeHtml(
                                    next.ticket_code
                                )}
                            </button>

                          `
                        : ""
                }


            </section>


            <p
                id="barberDashboardMessage"
                class="tb-message"
            >
                ${escapeHtml(
                    message
                )}
            </p>


            <div class="tb-footer">
                Actualización automática cada 5 segundos
            </div>


            <div
                style="
                    text-align:center;
                    margin-top:2px;
                "
            >

                <button
                    class="btn"
                    type="button"
                    onclick="barberLogout()"
                >
                    🚪 Cerrar sesión
                </button>

            </div>


        </div>

    `;

}


/* ==========================================================
   ERROR
========================================================== */


function showError(
    message
) {

    if (!dashboard) {
        return;
    }


    dashboard.innerHTML = `

        <section
            class="card hero"
            style="
                text-align:center;
                padding:30px 20px;
            "
        >

            <div style="font-size:45px;">
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


/* ==========================================================
   CARGAR DASHBOARD
========================================================== */


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


        dashboard.style.display =
            "block";


        dashboard.innerHTML = `

            <section
                class="card hero"
                style="
                    text-align:center;
                "
            >

                <h2>
                    🔄 Cargando tu cola...
                </h2>

            </section>

        `;


        const valid =
            await verifyBarberAccess();


        if (!valid) {
            return;
        }


        await loadQueue();


        renderDashboard();


    } catch (error) {

        console.error(
            "ERROR MODULO BARBERO:",
            error
        );


        showError(
            error.message ||
            "No fue posible cargar la estación."
        );


    } finally {

        loadingDashboard =
            false;

    }

}


/* ==========================================================
   LLAMAR SIGUIENTE
========================================================== */


async function callNext() {

    if (
        runningAction ||
        accessBlocked
    ) {
        return;
    }


    runningAction =
        true;


    renderDashboard();


    try {

        const valid =
            await verifyBarberAccess();


        if (!valid) {
            return;
        }


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


        await loadQueue();


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


        if (
            barberProfile &&
            !accessBlocked
        ) {

            renderDashboard();

        }

    }

}


/* ==========================================================
   FINALIZAR TURNO
========================================================== */


async function finishTicket(
    ticketId
) {

    if (
        !ticketId ||
        runningAction ||
        accessBlocked
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


    renderDashboard();


    try {

        const valid =
            await verifyBarberAccess();


        if (!valid) {
            return;
        }


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


        await loadQueue();


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


        if (
            barberProfile &&
            !accessBlocked
        ) {

            renderDashboard();

        }

    }

}


/* ==========================================================
   NO SE PRESENTÓ
========================================================== */


async function noShowTicket(
    ticketId
) {

    if (
        !ticketId ||
        runningAction ||
        accessBlocked
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


    renderDashboard();


    try {

        const valid =
            await verifyBarberAccess();


        if (!valid) {
            return;
        }


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


        await loadQueue();


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


        if (
            barberProfile &&
            !accessBlocked
        ) {

            renderDashboard();

        }

    }

}


/* ==========================================================
   CERRAR SESIÓN
========================================================== */


async function barberLogout() {

    stopAutoRefresh();


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


/* ==========================================================
   ACTUALIZACIÓN AUTOMÁTICA

   Cada 5 segundos:
   1. Comprueba que la sesión siga activa.
   2. Comprueba que el barbero siga activo.
   3. Si está activo, actualiza la cola.
   4. Si dejó de estar activo, bloquea la estación.
========================================================== */


function startAutoRefresh() {

    stopAutoRefresh();


    refreshTimer =
        setInterval(
            async () => {

                if (
                    document.hidden ||
                    runningAction ||
                    accessBlocked ||
                    !barberProfile
                ) {
                    return;
                }


                try {

                    const valid =
                        await verifyBarberAccess();


                    if (!valid) {
                        return;
                    }


                    await loadQueue();


                    if (
                        !accessBlocked
                    ) {

                        renderDashboard();

                    }


                } catch (error) {

                    console.error(
                        "ERROR ACTUALIZANDO ESTACIÓN:",
                        error
                    );

                }

            },
            5000
        );

}


/* ==========================================================
   DETENER ACTUALIZACIÓN
========================================================== */


function stopAutoRefresh() {

    if (refreshTimer) {

        clearInterval(
            refreshTimer
        );


        refreshTimer =
            null;

    }

}


/* ==========================================================
   INICIAR MÓDULO
========================================================== */


async function startBarberModule() {

    const params =
        new URLSearchParams(
            window.location.search
        );


    if (
        params.get("mode") !==
            "dashboard" ||
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


    if (
        barberProfile &&
        !accessBlocked
    ) {

        startAutoRefresh();

    }

}


/* ==========================================================
   CAMBIO DE SESIÓN
========================================================== */


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

            stopAutoRefresh();

        }


        if (
            session &&
            new URLSearchParams(
                window.location.search
            ).get("mode") ===
                "dashboard"
        ) {

            startBarberModule();

        }

    }
);


/* ==========================================================
   INICIO
========================================================== */


document.addEventListener(
    "DOMContentLoaded",
    startBarberModule
);

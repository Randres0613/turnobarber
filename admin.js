const adminApp = document.getElementById("adminApp");
const businessInfo = document.getElementById("businessInfo");
const connectionStatus = document.getElementById("connectionStatus");

const businessId =
    new URLSearchParams(location.search).get("business")
    || "d09f71b0-2010-42c2-8d5c-b14b0ab35dd1";

let business = null;
let currentTicket = null;
let waitingTickets = [];


// ==========================================
// CARGAR BARBERÍA
// ==========================================

async function loadBusiness() {

    connectionStatus.textContent = "CONECTANDO...";

    try {

        // Buscamos la barbería mediante su QR.
        // Por ahora usamos el slug conocido.
        const { data, error } =
            await client.rpc(
                "get_business_by_qr",
                {
                    p_qr_slug: "barberia-el-jefe"
                }
            );

        if (error) {
            throw error;
        }

        if (!data || data.length === 0) {
            throw new Error("No se encontró la barbería.");
        }

        business = data[0];

        businessInfo.textContent =
            `${business.name} · ${business.city || ""}`;

        connectionStatus.textContent = "ONLINE";

        await loadPanel();

    } catch (error) {

        console.error("ERROR ADMIN:", error);

        connectionStatus.textContent = "ERROR";

        adminApp.innerHTML = `
            <div class="card hero">

                <h2>⚠️ Error cargando el panel</h2>

                <p>
                    ${error.message}
                </p>

                <button
                    class="btn"
                    onclick="location.reload()"
                >
                    🔄 Reintentar
                </button>

            </div>
        `;
    }
}


// ==========================================
// CARGAR PANEL
// ==========================================

async function loadPanel() {

    await loadCurrentTicket();

    await loadWaitingTickets();

    renderPanel();
}


// ==========================================
// TURNO ACTUAL
// ==========================================

async function loadCurrentTicket() {

    const { data, error } =
        await client.rpc(
            "admin_current_ticket",
            {
                p_business_id: business.id
            }
        );

    if (error) {
        console.error(error);
        currentTicket = null;
        return;
    }

    currentTicket =
        data && data.length > 0
            ? data[0]
            : null;
}


// ==========================================
// TURNOS EN ESPERA
// ==========================================

async function loadWaitingTickets() {

    const { data, error } =
        await client.rpc(
            "admin_waiting_tickets",
            {
                p_business_id: business.id
            }
        );

    if (error) {
        console.error(error);
        waitingTickets = [];
        return;
    }

    waitingTickets = data || [];
}


// ==========================================
// MOSTRAR PANEL
// ==========================================

function renderPanel() {

    adminApp.innerHTML = `

        <section class="card current">

            <h2>TURNO ACTUAL</h2>

            ${
                currentTicket
                ?
                `
                <div class="current-ticket">

                    <div class="ticket-number">
                        ${currentTicket.ticket_code}
                    </div>

                    <h2>
                        ${currentTicket.service_name}
                    </h2>

                    <p class="badge">
                        🟢 EN ATENCIÓN
                    </p>

                </div>

                <div class="actions">

                    <button
                        class="btn success"
                        onclick="finishCurrent()"
                    >
                        ✅ Finalizar
                    </button>

                    <button
                        class="btn danger"
                        onclick="noShowCurrent()"
                    >
                        🚫 No se presentó
                    </button>

                </div>
                `
                :
                `
                <div class="empty">

                    <h2>
                        No hay turno en atención
                    </h2>

                    <p>
                        Listo para llamar al siguiente cliente.
                    </p>

                </div>
                `
            }

        </section>


        <section class="card">

            <div class="queue-header">

                <h2>PRÓXIMOS TURNOS</h2>

                <span class="badge">
                    ${waitingTickets.length} esperando
                </span>

            </div>

            ${
                waitingTickets.length === 0
                ?
                `
                <div class="empty">
                    <p>No hay clientes esperando.</p>
                </div>
                `
                :
                `
                <div class="queue">

                    ${
                        waitingTickets
                            .map((ticket, index) => `

                                <div class="queue-item">

                                    <div>

                                        <strong>
                                            ${ticket.ticket_code}
                                        </strong>

                                        <span>
                                            ${ticket.service_name}
                                        </span>

                                    </div>

                                    <small>
                                        ${
                                            index === 0
                                            ? "Siguiente"
                                            : `${index} antes`
                                        }
                                    </small>

                                </div>

                            `)
                            .join("")
                    }

                </div>
                `
            }

        </section>


        <button
            class="btn primary big"
            onclick="callNext()"
            ${currentTicket ? "disabled" : ""}
        >
            📢 Llamar siguiente
        </button>

    `;
}


// ==========================================
// LLAMAR SIGUIENTE
// ==========================================

async function callNext() {

    if (currentTicket) {
        alert("Primero debes finalizar el turno actual.");
        return;
    }

    const { data, error } =
        await client.rpc(
            "admin_call_next",
            {
                p_business_id: business.id
            }
        );

    if (error) {
        alert(error.message);
        return;
    }

    currentTicket =
        data && data.length > 0
            ? data[0]
            : null;

    await loadPanel();
}


// ==========================================
// FINALIZAR
// ==========================================

async function finishCurrent() {

    if (!currentTicket) return;

    const { data, error } =
        await client.rpc(
            "admin_finish_ticket",
            {
                p_ticket_id: currentTicket.id
            }
        );

    if (error) {
        alert(error.message);
        return;
    }

    if (!data) {
        alert("No se pudo finalizar el turno.");
        return;
    }

    currentTicket = null;

    await loadPanel();
}


// ==========================================
// NO SE PRESENTÓ
// ==========================================

async function noShowCurrent() {

    if (!currentTicket) return;

    const { data, error } =
        await client.rpc(
            "admin_no_show_ticket",
            {
                p_ticket_id: currentTicket.id
            }
        );

    if (error) {
        alert(error.message);
        return;
    }

    if (!data) {
        alert("No se pudo cambiar el estado.");
        return;
    }

    currentTicket = null;

    await loadPanel();
}


// ==========================================
// ACTUALIZACIÓN AUTOMÁTICA
// ==========================================

setInterval(
    loadPanel,
    10000
);


// ==========================================
// INICIAR
// ==========================================

loadBusiness();

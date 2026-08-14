const app = document.getElementById("app");
const statusEl = document.getElementById("status");

const slug =
    new URLSearchParams(location.search).get("b")
    || "barberia-el-jefe";

let business = null;
let services = [];
let currentTicket = null;


// ==========================================
// CARGAR BARBERÍA
// ==========================================

async function loadBusiness() {

    statusEl.textContent = "Conectando...";

    const { data, error } =
        await client.rpc(
            "get_business_by_qr",
            {
                p_qr_slug: slug
            }
        );

    if (error) {

        console.error(error);

        statusEl.textContent = "Error";

        app.innerHTML = `
            <div class="card hero">

                <h2>⚠️ Error de conexión</h2>

                <p>
                    ${error.message}
                </p>

            </div>
        `;

        return false;
    }


    if (!data || data.length === 0) {

        statusEl.textContent = "No encontrada";

        app.innerHTML = `
            <div class="card hero">

                <h2>
                    💈 Barbería no encontrada
                </h2>

                <p>
                    No encontramos la barbería:
                </p>

                <strong>
                    ${slug}
                </strong>

            </div>
        `;

        return false;
    }


    business = data[0];

    await loadServices();

    return true;
}


// ==========================================
// CARGAR SERVICIOS
// ==========================================

async function loadServices() {

    const { data, error } =
        await client
            .from("services")
            .select(
                "id,business_id,name,price,duration_minutes,active"
            )
            .eq(
                "business_id",
                business.id
            )
            .eq(
                "active",
                true
            )
            .order("name");


    if (error) {

        console.error(error);

        statusEl.textContent = "Error";

        app.innerHTML = `
            <div class="card hero">

                <h2>
                    ⚠️ Error cargando servicios
                </h2>

                <p>
                    ${error.message}
                </p>

            </div>
        `;

        return;
    }


    services = data || [];

    statusEl.textContent = "Conectado";

}


// ==========================================
// MOSTRAR SERVICIOS
// ==========================================

function renderCustomer() {

    app.innerHTML = `

        <div class="card hero">

            <h1>
                💈 ${business.name}
            </h1>

            <p class="muted">
                ${business.city || ""}
            </p>

            <span class="badge">
                ONLINE
            </span>

        </div>


        <div class="card">

            <h2>
                Elige tu servicio
            </h2>

            ${
                services.length === 0

                ?

                `
                <p class="muted">
                    No hay servicios disponibles.
                </p>
                `

                :

                `
                <div class="grid">

                    ${
                        services
                            .map(service => `

                                <div class="service">

                                    <h3>
                                        ${service.name}
                                    </h3>

                                    <p>
                                        ${service.duration_minutes}
                                        min
                                        ·
                                        ${money(service.price)}
                                    </p>

                                    <button
                                        class="btn"
                                        onclick="takeTurn('${service.id}')"
                                    >
                                        Tomar turno
                                    </button>

                                </div>

                            `)
                            .join("")
                    }

                </div>
                `
            }

        </div>

    `;
}


// ==========================================
// FORMATO DINERO
// ==========================================

function money(value) {

    return "$" +
        Number(value || 0)
            .toLocaleString("es-CO");

}


// ==========================================
// TOMAR TURNO
// ==========================================

async function takeTurn(serviceId) {

    const service =
        services.find(
            s => s.id === serviceId
        );


    if (!service) {

        alert("No se encontró el servicio.");

        return;
    }


    app.innerHTML = `

        <div class="card hero">

            <h2>
                ⏳ Tomando tu turno...
            </h2>

            <p>
                Espera un momento.
            </p>

        </div>

    `;


    const { data, error } =
        await client.rpc(
            "public_take_ticket",
            {
                p_business_id: business.id,
                p_service_id: service.id
            }
        );


    if (error) {

        console.error(error);

        app.innerHTML = `

            <div class="card hero">

                <h2>
                    ⚠️ No pudimos tomar tu turno
                </h2>

                <p>
                    ${error.message}
                </p>

                <button
                    class="btn"
                    onclick="renderCustomer()"
                >
                    Volver
                </button>

            </div>

        `;

        return;
    }


    if (!data || data.length === 0) {

        app.innerHTML = `

            <div class="card hero">

                <h2>
                    ⚠️ No se creó el turno
                </h2>

                <button
                    class="btn"
                    onclick="renderCustomer()"
                >
                    Volver
                </button>

            </div>

        `;

        return;
    }


    currentTicket = data[0];


    // ======================================
    // GUARDAR TURNO
    // ======================================

    saveTicket();


    // Mostrar pantalla del turno

    showTicket();

}


// ==========================================
// GUARDAR TURNO
// ==========================================

function saveTicket() {

    if (!currentTicket || !currentTicket.id) {
        return;
    }


    localStorage.setItem(
        "turnobarber_ticket",
        JSON.stringify({
            ticket_id: currentTicket.id,
            business_id: business.id,
            business_slug: slug
        })
    );

}


// ==========================================
// OBTENER TURNO GUARDADO
// ==========================================

function getSavedTicket() {

    const saved =
        localStorage.getItem(
            "turnobarber_ticket"
        );


    if (!saved) {
        return null;
    }


    try {

        return JSON.parse(saved);

    } catch (error) {

        console.error(
            "Error leyendo turno guardado:",
            error
        );

        localStorage.removeItem(
            "turnobarber_ticket"
        );

        return null;
    }

}


// ==========================================
// BORRAR TURNO GUARDADO
// ==========================================

function clearSavedTicket() {

    localStorage.removeItem(
        "turnobarber_ticket"
    );

}


// ==========================================
// MOSTRAR TURNO
// ==========================================

function showTicket() {

    if (!currentTicket) {
        return;
    }


    app.innerHTML = `

        <div class="card hero">

            <h1>
                💈 ${business.name}
            </h1>

            <p class="muted">
                ${business.city || ""}
            </p>

        </div>


        <div id="ticketStatus">

            <div class="card ticket-card">

                <p>
                    TU TURNO
                </p>

                <div class="ticket-number">
                    ${currentTicket.ticket_code || "..."}
                </div>

                <h2>
                    ${currentTicket.service_name || ""}
                </h2>

                <span
                    id="ticketBadge"
                    class="badge"
                >
                    🟡 ESPERANDO
                </span>


                <div id="ticketDetails">

                    <p>
                        Consultando tu posición...
                    </p>

                </div>

            </div>


            <div class="card">

                <p class="muted">
                    Esta página se actualiza
                    automáticamente.
                </p>

                <button
                    class="btn"
                    onclick="checkTicketStatus()"
                >
                    🔄 Actualizar
                </button>

            </div>

        </div>

    `;


    checkTicketStatus();

}


// ==========================================
// CONSULTAR ESTADO
// ==========================================

async function checkTicketStatus() {

    if (!currentTicket || !currentTicket.id) {
        return;
    }


    const { data, error } =
        await client.rpc(
            "public_ticket_status",
            {
                p_ticket_id: currentTicket.id
            }
        );


    if (error) {

        console.error(
            "Error consultando turno:",
            error
        );

        return;
    }


    if (!data || data.length === 0) {

        return;
    }


    const ticket = data[0];


    currentTicket = {
        ...currentTicket,
        ...ticket
    };


    renderTicketStatus(ticket);

}


// ==========================================
// ACTUALIZAR ESTADO VISUAL
// ==========================================

function renderTicketStatus(ticket) {

    const details =
        document.getElementById(
            "ticketDetails"
        );


    const badge =
        document.getElementById(
            "ticketBadge"
        );


    if (!details) {
        return;
    }


    // ======================================
    // ESPERANDO
    // ======================================

    if (ticket.status === "waiting") {

        if (badge) {

            badge.textContent =
                "🟡 ESPERANDO";

        }


        details.innerHTML = `

            <div class="status-box">

                <h3>
                    🟡 Estás en espera
                </h3>

                <p>
                    Hay
                    <strong>
                        ${ticket.people_ahead}
                    </strong>
                    personas antes que tú.
                </p>

                <p>
                    ⏱️ Tiempo estimado:
                    <strong>
                        ${ticket.estimated_minutes}
                        min
                    </strong>
                </p>

            </div>

        `;

        return;
    }


    // ======================================
    // LLAMADO / EN ATENCIÓN
    // ======================================

    if (
        ticket.status === "called" ||
        ticket.status === "serving"
    ) {

        if (badge) {

            badge.textContent =
                "🟢 ¡ES TU TURNO!";

        }


        details.innerHTML = `

            <div class="status-box">

                <h2>
                    🟢 ¡ES TU TURNO!
                </h2>

                <p>
                    Pasa a la barbería.
                </p>

            </div>

        `;

        return;
    }


    // ======================================
    // FINALIZADO
    // ======================================

    if (ticket.status === "done") {

        if (badge) {

            badge.textContent =
                "✅ FINALIZADO";

        }


        details.innerHTML = `

            <div class="status-box">

                <h2>
                    ✅ Turno finalizado
                </h2>

                <p>
                    Gracias por visitarnos.
                </p>

            </div>

        `;


        // El turno ya terminó.
        // Lo quitamos del navegador.

        clearSavedTicket();

        return;
    }


    // ======================================
    // NO SE PRESENTÓ
    // ======================================

    if (ticket.status === "no_show") {

        if (badge) {

            badge.textContent =
                "🚫 NO PRESENTADO";

        }


        details.innerHTML = `

            <div class="status-box">

                <h2>
                    🚫 Turno marcado como
                    no presentado
                </h2>

                <p>
                    Este turno ya no está activo.
                </p>

            </div>

        `;


        clearSavedTicket();

        return;
    }


    // ======================================
    // CANCELADO
    // ======================================

    if (ticket.status === "cancelled") {

        if (badge) {

            badge.textContent =
                "❌ CANCELADO";

        }


        details.innerHTML = `

            <div class="status-box">

                <h2>
                    ❌ Turno cancelado
                </h2>

                <p>
                    Este turno ya no está activo.
                </p>

            </div>

        `;


        clearSavedTicket();

        return;
    }

}


// ==========================================
// RECUPERAR TURNO AL ABRIR LA PÁGINA
// ==========================================

async function restoreSavedTicket() {

    const savedTicket =
        getSavedTicket();


    if (!savedTicket) {

        renderCustomer();

        return;
    }


    // Comprobar que pertenece
    // a esta barbería.

    if (
        savedTicket.business_slug !== slug
    ) {

        clearSavedTicket();

        renderCustomer();

        return;
    }


    // Reconstruimos el objeto mínimo
    // necesario para consultar Supabase.

    currentTicket = {
        id: savedTicket.ticket_id
    };


    // Consultamos el estado real.

    const { data, error } =
        await client.rpc(
            "public_ticket_status",
            {
                p_ticket_id:
                    savedTicket.ticket_id
            }
        );


    if (error) {

        console.error(
            "Error recuperando turno:",
            error
        );

        clearSavedTicket();

        renderCustomer();

        return;
    }


    if (!data || data.length === 0) {

        clearSavedTicket();

        renderCustomer();

        return;
    }


    const ticket = data[0];


    currentTicket = {
        id: savedTicket.ticket_id,
        ...ticket
    };


    // Si ya terminó, no lo recuperamos.

    if (
        ticket.status === "done" ||
        ticket.status === "cancelled" ||
        ticket.status === "no_show"
    ) {

        clearSavedTicket();

        renderCustomer();

        return;
    }


    // Mostrar turno recuperado.

    showTicket();

}


// ==========================================
// ACTUALIZACIÓN AUTOMÁTICA
// ==========================================

setInterval(
    checkTicketStatus,
    5000
);


// ==========================================
// INICIAR APLICACIÓN
// ==========================================

async function startApp() {

    const loaded =
        await loadBusiness();


    if (!loaded) {
        return;
    }


    await restoreSavedTicket();

}


startApp();

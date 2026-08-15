```javascript
const app = document.getElementById("app");
const statusEl = document.getElementById("status");

const slug =
    new URLSearchParams(location.search).get("b")
    || "barberia-el-jefe";

let business = null;
let services = [];
let currentTicket = null;


// ==========================================
// CLAVE PARA GUARDAR EL TURNO
// ==========================================

const SAVED_TICKET_KEY =
    "turnobarber_ticket";


// ==========================================
// FECHA LOCAL DE COLOMBIA
// ==========================================

function getColombiaDate() {

    return new Intl.DateTimeFormat(
        "en-CA",
        {
            timeZone: "America/Bogota",
            year: "numeric",
            month: "2-digit",
            day: "2-digit"
        }
    ).format(
        new Date()
    );

}


// ==========================================
// CARGAR BARBERÍA
// ==========================================

async function loadBusiness() {

    statusEl.textContent =
        "Conectando...";


    const { data, error } =
        await client.rpc(
            "get_business_by_qr",
            {
                p_qr_slug: slug
            }
        );


    if (error) {

        console.error(
            "Error cargando barbería:",
            error
        );

        statusEl.textContent =
            "Error";


        app.innerHTML = `

            <div class="card hero">

                <h2>
                    ⚠️ Error de conexión
                </h2>

                <p>
                    ${error.message}
                </p>

            </div>

        `;

        return false;
    }


    if (!data || data.length === 0) {

        statusEl.textContent =
            "No encontrada";


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


    business =
        data[0];


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

        console.error(
            "Error cargando servicios:",
            error
        );

        statusEl.textContent =
            "Error";


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


    services =
        data || [];


    statusEl.textContent =
        "Conectado";

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
                            .map(
                                service => `

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

                                `
                            )
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

    // ======================================
    // SEGURIDAD:
    // SI YA HAY UN TURNO ACTIVO,
    // NO CREAR OTRO
    // ======================================

    const savedTicket =
        getSavedTicket();


    if (savedTicket) {

        if (
            savedTicket.business_slug === slug &&
            savedTicket.business_id === business.id &&
            savedTicket.jornada === getColombiaDate()
        ) {

            await restoreSavedTicket();

            return;
        }

    }


    const service =
        services.find(
            s => s.id === serviceId
        );


    if (!service) {

        alert(
            "No se encontró el servicio."
        );

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
                p_business_id:
                    business.id,

                p_service_id:
                    service.id
            }
        );


    if (error) {

        console.error(
            "Error tomando turno:",
            error
        );


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


    currentTicket =
        data[0];


    // ======================================
    // GUARDAR TURNO INMEDIATAMENTE
    // ======================================

    saveTicket();


    // ======================================
    // MOSTRAR TURNO
    // ======================================

    showTicket();

}


// ==========================================
// GUARDAR TURNO
// ==========================================

function saveTicket() {

    if (
        !currentTicket ||
        !currentTicket.id ||
        !business
    ) {

        return;
    }


    const savedData = {

        ticket_id:
            currentTicket.id,

        ticket_code:
            currentTicket.ticket_code || "",

        service_name:
            currentTicket.service_name || "",

        business_id:
            business.id,

        business_slug:
            slug,

        jornada:
            getColombiaDate(),

        saved_at:
            Date.now()

    };


    try {

        localStorage.setItem(
            SAVED_TICKET_KEY,
            JSON.stringify(savedData)
        );


        console.log(
            "Turno guardado:",
            savedData
        );

    } catch (error) {

        console.error(
            "No se pudo guardar el turno:",
            error
        );

    }

}


// ==========================================
// OBTENER TURNO GUARDADO
// ==========================================

function getSavedTicket() {

    let saved = null;


    try {

        saved =
            localStorage.getItem(
                SAVED_TICKET_KEY
            );

    } catch (error) {

        console.error(
            "Error accediendo a localStorage:",
            error
        );

        return null;
    }


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

        return null;
    }

}


// ==========================================
// BORRAR TURNO GUARDADO
// ==========================================

function clearSavedTicket() {

    try {

        localStorage.removeItem(
            SAVED_TICKET_KEY
        );

    } catch (error) {

        console.error(
            "Error eliminando turno guardado:",
            error
        );

    }

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

    if (
        !currentTicket ||
        !currentTicket.id
    ) {

        return;
    }


    const { data, error } =
        await client.rpc(
            "public_ticket_status",
            {
                p_ticket_id:
                    currentTicket.id
            }
        );


    // ======================================
    // MUY IMPORTANTE:
    // SI HAY ERROR DE RED NO BORRAMOS
    // EL TURNO
    // ======================================

    if (error) {

        console.error(
            "Error consultando turno:",
            error
        );

        const details =
            document.getElementById(
                "ticketDetails"
            );


        if (details) {

            details.innerHTML = `

                <div class="status-box">

                    <p>
                        🔄 Conectando con
                        TurnoBarber...
                    </p>

                </div>

            `;

        }


        return;
    }


    // ======================================
    // SI NO HAY DATOS:
    // NO BORRAR EL TURNO
    // ======================================

    if (
        !data ||
        data.length === 0
    ) {

        console.warn(
            "No se recibió información del turno."
        );

        return;
    }


    const ticket =
        data[0];


    currentTicket = {

        ...currentTicket,

        ...ticket

    };


    // ======================================
    // ACTUALIZAR INFORMACIÓN GUARDADA
    // ======================================

    saveTicket();


    renderTicketStatus(
        ticket
    );

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

    if (
        ticket.status === "waiting"
    ) {

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

    if (
        ticket.status === "done"
    ) {

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


        // ==================================
        // AHORA SÍ:
        // EL TURNO TERMINÓ
        // ==================================

        clearSavedTicket();

        return;
    }


    // ======================================
    // NO SE PRESENTÓ
    // ======================================

    if (
        ticket.status === "no_show"
    ) {

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

    if (
        ticket.status === "cancelled"
    ) {

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
// RECUPERAR TURNO AL ABRIR / ACTUALIZAR
// ==========================================

async function restoreSavedTicket() {

    const savedTicket =
        getSavedTicket();


    // ======================================
    // NO HAY TURNO GUARDADO
    // ======================================

    if (!savedTicket) {

        renderCustomer();

        return;
    }


    // ======================================
    // COMPROBAR BARBERÍA
    // ======================================

    if (
        savedTicket.business_slug !== slug ||
        savedTicket.business_id !== business.id
    ) {

        clearSavedTicket();

        renderCustomer();

        return;
    }


    // ======================================
    // COMPROBAR JORNADA
    // ======================================

    if (
        savedTicket.jornada &&
        savedTicket.jornada !== getColombiaDate()
    ) {

        clearSavedTicket();

        renderCustomer();

        return;
    }


    // ======================================
    // RECONSTRUIR TURNO
    // ======================================

    currentTicket = {

        id:
            savedTicket.ticket_id,

        ticket_code:
            savedTicket.ticket_code || "",

        service_name:
            savedTicket.service_name || ""

    };


    // ======================================
    // MOSTRARLO INMEDIATAMENTE
    // ======================================
    //
    // Esto evita que al actualizar
    // aparezca otra vez "Tomar turno".
    //
    // ======================================

    showTicket();


    // ======================================
    // CONSULTAR ESTADO REAL
    // ======================================

    const { data, error } =
        await client.rpc(
            "public_ticket_status",
            {
                p_ticket_id:
                    savedTicket.ticket_id
            }
        );


    // ======================================
    // SI HAY ERROR:
    // MANTENER EL TURNO
    // ======================================

    if (error) {

        console.error(
            "Error recuperando turno:",
            error
        );

        return;
    }


    // ======================================
    // SI NO HAY DATOS:
    // MANTENER EL TURNO
    // ======================================

    if (
        !data ||
        data.length === 0
    ) {

        console.warn(
            "No se recibió información del turno guardado."
        );

        return;
    }


    const ticket =
        data[0];


    currentTicket = {

        id:
            savedTicket.ticket_id,

        ...ticket

    };


    // ======================================
    // ACTUALIZAR DATOS GUARDADOS
    // ======================================

    saveTicket();


    // ======================================
    // SI TERMINÓ:
    // LIMPIAR
    // ======================================

    if (
        ticket.status === "done" ||
        ticket.status === "cancelled" ||
        ticket.status === "no_show"
    ) {

        renderTicketStatus(
            ticket
        );

        return;
    }


    // ======================================
    // MOSTRAR ESTADO ACTUAL
    // ======================================

    renderTicketStatus(
        ticket
    );

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
```

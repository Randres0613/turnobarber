const app = document.getElementById("app");
const statusEl = document.getElementById("status");


// ==========================================
// DETECTAR CONFIRMACIÓN DE CORREO
// ==========================================

const hashParams = new URLSearchParams(
    window.location.hash.replace(/^#/, "")
);

const queryParams = new URLSearchParams(
    window.location.search
);

const isSignupConfirmation =
    hashParams.get("type") === "signup" ||
    queryParams.get("type") === "signup" ||
    queryParams.has("code");

if (isSignupConfirmation) {
    window.location.replace("login.html");
}


// ==========================================
// CONFIGURACIÓN
// ==========================================

const slug =
    new URLSearchParams(location.search).get("b")
    || "barberia-el-jefe";

let business = null;
let services = [];
let barbers = [];
let currentTicket = null;
let businessTimezone = "UTC";

function escapeHtml(value) {
    return String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}


// ==========================================
// FECHA ACTUAL DE LA BARBERÍA
// ==========================================

function getBusinessDate() {

    return new Intl.DateTimeFormat(
        "en-CA",
        {
            timeZone: businessTimezone || "UTC",
            year: "numeric",
            month: "2-digit",
            day: "2-digit"
        }
    ).format(new Date());

}


// ==========================================
// CARGAR ZONA HORARIA
// ==========================================

async function loadBusinessTimezone() {

    if (!business || !business.id) {
        businessTimezone = "UTC";
        return;
    }

    try {

        const { data, error } =
            await client.rpc(
                "get_business_timezone",
                {
                    p_business_id: business.id
                }
            );

        if (error) {

            console.warn(
                "No se pudo obtener la zona horaria. Se usará UTC.",
                error
            );

            businessTimezone = "UTC";
            return;
        }

        if (typeof data === "string" && data) {

            businessTimezone = data;
            return;
        }

        if (Array.isArray(data) && data.length > 0) {

            businessTimezone =
                data[0]?.timezone ||
                data[0] ||
                "UTC";

            return;
        }

        if (data && typeof data === "object") {

            businessTimezone =
                data.timezone ||
                "UTC";

            return;
        }

        businessTimezone = "UTC";

    } catch (error) {

        console.warn(
            "Error obteniendo zona horaria. Se usará UTC.",
            error
        );

        businessTimezone = "UTC";
    }

}


// ==========================================
// CARGAR BARBEROS SEGÚN EL SERVICIO
// ==========================================
//
// Solamente se muestran los barberos que:
// 1. pertenecen a la barbería
// 2. están activos
// 3. tienen asignado el servicio seleccionado
// ==========================================

async function loadBarbers(serviceId) {

    if (!business || !serviceId) {

        barbers = [];

        return false;
    }

    try {

        const { data, error } =
            await client.rpc(
                "public_get_barbers_for_service",
                {
                    p_business_id: business.id,
                    p_service_id: serviceId
                }
            );

        if (error) {

            console.error(
                "Error cargando barberos para el servicio:",
                error
            );

            barbers = [];

            return false;
        }

        barbers = data || [];

        return true;

    } catch (error) {

        console.error(
            "Error inesperado cargando barberos:",
            error
        );

        barbers = [];

        return false;
    }

}


// ==========================================
// CARGAR BARBERO DEL TURNO
// ==========================================
//
// Esta función permite recuperar el barbero
// incluso después de que el cliente recargue
// la página o vuelva a abrirla.
// ==========================================

async function loadTicketBarber(ticketId) {

    if (!ticketId) {

        return null;
    }

    try {

        const { data, error } =
            await client.rpc(
                "public_ticket_barber",
                {
                    p_ticket_id: ticketId
                }
            );

        if (error) {

            console.error(
                "Error cargando barbero del turno:",
                error
            );

            return null;
        }

        if (
            !data ||
            data.length === 0
        ) {

            return null;
        }

        return data[0];

    } catch (error) {

        console.error(
            "Error inesperado cargando barbero del turno:",
            error
        );

        return null;
    }

}


// ==========================================
// CARGAR BARBERÍA
// ==========================================

async function loadBusiness() {

    statusEl.textContent =
        "Conectando...";

    try {

        const { data, error } =
            await client.rpc(
                "get_business_by_qr",
                {
                    p_qr_slug: slug
                }
            );

        if (error) {

            console.error(error);

            statusEl.textContent =
                "Error";

            app.innerHTML = `
                <div class="card hero">

                    <h2>
                        ⚠️ Error de conexión
                    </h2>

                    <p>
                        ${escapeHtml(error.message)}
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
                        ${escapeHtml(slug)}
                    </strong>

                </div>
            `;

            return false;
        }

        business =
            data[0];

        await loadServices();

        return true;

    } catch (error) {

        console.error(
            "Error inesperado cargando barbería:",
            error
        );

        statusEl.textContent =
            "Error";

        app.innerHTML = `
            <div class="card hero">

                <h2>
                    ⚠️ Error cargando barbería
                </h2>

                <p>
                    ${escapeHtml(error.message || error)}
                </p>

                <button
                    class="btn"
                    onclick="location.reload()"
                >
                    🔄 Intentar nuevamente
                </button>

            </div>
        `;

        return false;
    }

}


// ==========================================
// CARGAR SERVICIOS
// ==========================================

async function loadServices() {

    try {

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

            statusEl.textContent =
                "Error";

            app.innerHTML = `
                <div class="card hero">

                    <h2>
                        ⚠️ Error cargando servicios
                    </h2>

                    <p>
                        ${escapeHtml(error.message)}
                    </p>

                    <button
                        class="btn"
                        onclick="location.reload()"
                    >
                        🔄 Intentar nuevamente
                    </button>

                </div>
            `;

            return false;
        }

        services =
            data || [];

        statusEl.textContent =
            "Conectado";

        return true;

    } catch (error) {

        console.error(
            "Error inesperado cargando servicios:",
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
                    ${escapeHtml(error.message || error)}
                </p>

                <button
                    class="btn"
                    onclick="location.reload()"
                >
                    🔄 Intentar nuevamente
                </button>

            </div>
        `;

        return false;
    }

}


// ==========================================
// MOSTRAR SERVICIOS
// ==========================================

function renderCustomer() {

    app.innerHTML = `

        <div class="card hero">

            <h1>
                💈 ${escapeHtml(business.name)}
            </h1>

            <p class="muted">
                ${escapeHtml(business.city || "")}
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
                                            ${escapeHtml(service.name)}
                                        </h3>

                                        <p>
                                            ${Number(service.duration_minutes || 0)}
                                            min
                                            ·
                                            ${money(service.price)}
                                        </p>

                                        <button
                                            class="btn"
                                            onclick="takeTurn('${escapeHtml(service.id)}')"
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

        alert(
            "No se encontró el servicio."
        );

        return;
    }

    const loaded =
        await loadBarbers(service.id);

    if (!loaded) {

        app.innerHTML = `
            <div class="card hero">

                <h2>
                    ⚠️ No pudimos cargar los barberos
                </h2>

                <p>
                    Intenta nuevamente.
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

    renderBarberSelection(service);
}


// ==========================================
// ELEGIR BARBERO
// ==========================================

function renderBarberSelection(service) {

    app.innerHTML = `

        <div class="card hero">

            <h1>
                💈 ${escapeHtml(business.name)}
            </h1>

            <p class="muted">
                ${escapeHtml(business.city || "")}
            </p>

            <span class="badge">
                ONLINE
            </span>

        </div>

        <div class="card">

            <h2>
                Elige tu barbero
            </h2>

            <p>
                Servicio:
                <strong>
                    ${escapeHtml(service.name)}
                </strong>
            </p>

            <p class="muted">
                ${Number(service.duration_minutes || 0)}
                min
                ·
                ${money(service.price)}
            </p>

            ${
                barbers.length === 0

                ?

                `
                    <div class="status-box">

                        <h3>
                            ⚠️ No hay barberos disponibles
                        </h3>

                        <p>
                            En este momento no hay
                            barberos asignados a este servicio.
                        </p>

                    </div>
                `

                :

                `
                    <div class="grid">

                        ${
                            barbers
                                .map(barber => `

                                    <div class="service">

                                        <h3>
                                            💈 ${escapeHtml(barber.name)}
                                        </h3>

                                        <p>
                                            🟢 Disponible
                                        </p>

                                        <button
                                            class="btn"
                                            onclick="showTurnConfirmation(
                                                '${escapeHtml(service.id)}',
                                                '${escapeHtml(barber.id)}'
                                            )"
                                        >
                                            Elegir ${escapeHtml(barber.name)}
                                        </button>

                                    </div>

                                `)
                                .join("")
                        }

                    </div>
                `
            }

            <button
                class="btn"
                onclick="renderCustomer()"
                style="margin-top: 15px;"
            >
                ← Volver a servicios
            </button>

        </div>
    `;
}


// ==========================================
// CREAR TURNO CON BARBERO
// ==========================================

function showTurnConfirmation(
    serviceId,
    barberId
) {
    const service = services.find(s => s.id === serviceId);
    const barber = barbers.find(b => b.id === barberId);

    if (!service || !barber) {
        alert("No se encontró el servicio o el barbero.");
        return;
    }

    app.innerHTML = `
        <div class="card hero">
            <h1>💈 ${escapeHtml(business.name)}</h1>
            <p class="muted">Confirma los datos de tu turno</p>
        </div>
        <div class="card">
            <h2>Confirma tu turno</h2>
            <div class="status-box">
                <p><strong>Servicio:</strong> ${escapeHtml(service.name)}</p>
                <p><strong>Barbero:</strong> 💈 ${escapeHtml(barber.name)}</p>
                <p class="muted">${escapeHtml(service.duration_minutes)} min · ${money(service.price)}</p>
            </div>
            <button class="btn primary" onclick="takeTurnWithBarber('${escapeHtml(service.id)}','${escapeHtml(barber.id)}')">✅ Confirmar turno</button>
            <button class="btn secondary" onclick="renderBarberSelection(services.find(s => s.id === '${escapeHtml(service.id)}'))">← Volver</button>
        </div>`;
}

async function takeTurnWithBarber(
    serviceId,
    barberId
) {

    const service =
        services.find(
            s => s.id === serviceId
        );

    const barber =
        barbers.find(
            b => b.id === barberId
        );

    if (!service || !barber) {

        alert(
            "No se encontró el servicio o el barbero."
        );

        return;
    }

    app.innerHTML = `

        <div class="card hero">

            <h2>
                ⏳ Tomando tu turno...
            </h2>

            <p>
                ${escapeHtml(barber.name)}
                ·
                ${escapeHtml(service.name)}
            </p>

            <p>
                Espera un momento.
            </p>

        </div>
    `;

    try {

        const { data, error } =
            await client.rpc(
                "public_take_ticket",
                {
                    p_business_id:
                        business.id,

                    p_service_id:
                        service.id,

                    p_barber_id:
                        barber.id
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
                        ${escapeHtml(error.message)}
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

        currentTicket = {

            ...data[0],

            barber_id:
                barber.id,

            barber_name:
                barber.name

        };

        saveTicket();

        showTicket();

    } catch (error) {

        console.error(
            "Error inesperado creando turno:",
            error
        );

        app.innerHTML = `

            <div class="card hero">

                <h2>
                    ⚠️ Error creando el turno
                </h2>

                <p>
                    ${escapeHtml(error.message || error)}
                </p>

                <button
                    class="btn"
                    onclick="renderCustomer()"
                >
                    Volver
                </button>

            </div>
        `;
    }

}


// ==========================================
// GUARDAR TURNO
// ==========================================

function saveTicket() {

    if (
        !currentTicket ||
        !currentTicket.id
    ) {

        return;
    }

    localStorage.setItem(
        "turnobarber_ticket",
        JSON.stringify({

            ticket_id:
                currentTicket.id,

            business_id:
                business.id,

            business_slug:
                slug,

            ticket_date:
                getBusinessDate(),

            barber_id:
                currentTicket.barber_id || null,

            barber_name:
                currentTicket.barber_name || null

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
                💈 ${escapeHtml(business.name)}
            </h1>

            <p class="muted">
                ${escapeHtml(business.city || "")}
            </p>

        </div>

        <div id="ticketStatus">

            <div class="card ticket-card">

                <p>
                    TU TURNO
                </p>

                <div class="ticket-number">
                    ${escapeHtml(currentTicket.ticket_code || "...")}
                </div>

                <h2>
                    ${escapeHtml(currentTicket.service_name || "")}
                </h2>

                ${
                    currentTicket.barber_name

                    ?

                    `
                        <div class="barber-assigned">

                            <strong>
                                💈 Te atenderá
                            </strong>

                            <div>
                                ${escapeHtml(currentTicket.barber_name)}
                            </div>

                        </div>
                    `

                    :

                    ""
                }

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

    try {

        const { data, error } =
            await client.rpc(
                "public_ticket_status",
                {
                    p_ticket_id:
                        currentTicket.id
                }
            );

        if (error) {

            console.error(
                "Error consultando turno:",
                error
            );

            return;
        }

        if (
            !data ||
            data.length === 0
        ) {

            return;
        }

        const ticket =
            data[0];

        currentTicket = {

            ...currentTicket,

            ...ticket

        };

        renderTicketStatus(ticket);

    } catch (error) {

        console.error(
            "Error inesperado consultando turno:",
            error
        );
    }

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
                        ${Number(ticket.people_ahead || 0)}
                    </strong>
                    personas antes que tú.
                </p>

                <p>

                    ${
                        Number(
                            ticket.people_ahead || 0
                        ) === 0

                        ?

                        "🟢 Eres el próximo, espera el llamado"

                        :

                        Number(
                            ticket.estimated_minutes || 0
                        ) > 0

                        ?

                        `
                            ⏱️ Tiempo estimado:
                            <strong>
                                ${Number(ticket.estimated_minutes || 0)} min
                            </strong>
                        `

                        :

                        "🟢 Próximo turno"
                    }

                </p>

                <button
                    class="btn secondary"
                    type="button"
                    disabled
                    title="La cancelación requiere una operación segura en Supabase que aún no existe en este proyecto."
                >
                    Cancelar turno
                </button>

                <p class="tool-note">
                    La cancelación estará disponible cuando se habilite el RPC seguro en Supabase.
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
// RECUPERAR TURNO AL ABRIR LA PÁGINA
// ==========================================

async function restoreSavedTicket() {

    const savedTicket =
        getSavedTicket();

    if (!savedTicket) {

        renderCustomer();

        return;
    }


    if (
        savedTicket.business_slug !== slug
    ) {

        clearSavedTicket();

        renderCustomer();

        return;
    }


    // ======================================
    // COMPROBAR JORNADA
    // ======================================

    const today =
        getBusinessDate();


    if (
        !savedTicket.ticket_date ||
        savedTicket.ticket_date !== today
    ) {

        clearSavedTicket();

        renderCustomer();

        return;
    }


    currentTicket = {

        id:
            savedTicket.ticket_id,

        barber_id:
            savedTicket.barber_id || null,

        barber_name:
            savedTicket.barber_name || null

    };


    try {

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


        if (
            !data ||
            data.length === 0
        ) {

            clearSavedTicket();

            renderCustomer();

            return;
        }


        const ticket =
            data[0];


        currentTicket = {

            id:
                savedTicket.ticket_id,

            ...ticket,

            barber_id:
                savedTicket.barber_id || null,

            barber_name:
                savedTicket.barber_name || null

        };


        // ==================================
        // RECUPERAR BARBERO DESDE SUPABASE
        // ==================================

        const barber =
            await loadTicketBarber(
                savedTicket.ticket_id
            );


        if (barber) {

            currentTicket.barber_id =
                barber.barber_id || null;

            currentTicket.barber_name =
                barber.barber_name || null;

            saveTicket();
        }


        if (
            ticket.status === "done" ||
            ticket.status === "cancelled" ||
            ticket.status === "no_show"
        ) {

            clearSavedTicket();

            renderCustomer();

            return;
        }


        showTicket();

    } catch (error) {

        console.error(
            "Error inesperado recuperando turno:",
            error
        );

        clearSavedTicket();

        renderCustomer();
    }

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

    try {

        const loaded =
            await loadBusiness();

        if (!loaded) {

            return;
        }


        // IMPORTANTE:
        // Primero obtenemos la zona horaria
        // de la barbería y después recuperamos
        // el turno guardado.

        await loadBusinessTimezone();

        await restoreSavedTicket();

    } catch (error) {

        console.error(
            "Error iniciando TurnoBarber:",
            error
        );

        statusEl.textContent =
            "Error";

        app.innerHTML = `

            <div class="card hero">

                <h2>
                    ⚠️ No pudimos iniciar TurnoBarber
                </h2>

                <p>
                    ${escapeHtml(error.message || error)}
                </p>

                <button
                    class="btn"
                    onclick="location.reload()"
                >
                    🔄 Intentar nuevamente
                </button>

            </div>
        `;
    }

}


// ==========================================
// EJECUTAR APLICACIÓN
// ==========================================

startApp();

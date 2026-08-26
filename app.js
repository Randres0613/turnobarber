const app = document.getElementById("app");
const statusEl = document.getElementById("status");


// ==========================================
// DETECTAR CONFIRMACIÓN DE CORREO
// ==========================================
//
// Supabase puede devolver la confirmación mediante
// el hash (#) o mediante parámetros en la URL.
//
// Si detectamos que acaba de confirmar una cuenta,
// enviamos al usuario directamente al inicio de sesión.
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


// ==========================================
// FECHA ACTUAL DE LA BARBERÍA
// ==========================================
//
// La jornada se calcula usando la zona horaria
// configurada para cada barbería.
// Así TurnoBarber puede funcionar en Colombia,
// México, Chile, Argentina, España, etc.
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
    ).format(
        new Date()
    );

}


// ==========================================
// CARGAR ZONA HORARIA DE LA BARBERÍA
// ==========================================

async function loadBusinessTimezone() {

    const { data, error } =
        await client.rpc(
            "get_business_timezone",
            {
                p_business_id: business.id
            }
        );

    if (error) {

        console.warn(
            "No se pudo obtener la zona horaria de la barbería. Se usará UTC.",
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

}


// ==========================================
// CARGAR BARBEROS SEGÚN EL SERVICIO
// ==========================================
//
// IMPORTANTE:
//
// Ahora NO cargamos todos los barberos activos.
//
// Recibimos el servicio seleccionado y consultamos:
//
// public_get_barbers_for_service
//
// De esta manera solamente aparecen los barberos
// que tienen ese servicio asignado en barber_services.
// ==========================================

async function loadBarbers(serviceId) {

    if (!business || !serviceId) {

        barbers = [];

        return false;

    }


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

        console.error(error);

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

        console.error(error);

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

        alert(
            "No se encontró el servicio."
        );

        return;

    }


    // ======================================================
    // IMPORTANTE:
    // CARGAR SOLAMENTE LOS BARBEROS DE ESTE SERVICIO
    // ======================================================

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
                Elige tu barbero
            </h2>

            <p>
                Servicio:
                <strong>
                    ${service.name}
                </strong>
            </p>

            <p class="muted">
                ${service.duration_minutes}
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
                        En este momento no hay barberos
                        asignados a este servicio.
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
                                        💈 ${barber.name}
                                    </h3>

                                    <p>
                                        🟢 Disponible
                                    </p>

                                    <button
                                        class="btn"
                                        onclick="takeTurnWithBarber(
                                            '${service.id}',
                                            '${barber.id}'
                                        )"
                                    >
                                        Elegir ${barber.name}
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
                ${barber.name} · ${service.name}
            </p>

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


    currentTicket = {

        ...data[0],

        barber_id:
            barber.id,

        barber_name:
            barber.name

    };


    saveTicket();

    showTicket();

}


// ==========================================
// GUARDAR TURNO
// ==========================================
//
// Además del ID del turno, guardamos la fecha
// de la jornada en la zona horaria de la barbería.
//
// Esto permite saber si el turno pertenece
// al día actual o a una jornada anterior.
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
                getBusinessDate()

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

}


// =================================

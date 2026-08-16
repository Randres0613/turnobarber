const adminApp = document.getElementById("adminApp");
const loginApp = document.getElementById("loginApp");
const loginForm = document.getElementById("loginForm");
const loginEmail = document.getElementById("loginEmail");
const loginPassword = document.getElementById("loginPassword");
const loginButton = document.getElementById("loginButton");
const loginMessage = document.getElementById("loginMessage");

const businessInfo = document.getElementById("businessInfo");
const connectionStatus = document.getElementById("connectionStatus");

const businessId =
    new URLSearchParams(location.search).get("business")
    || "d09f71b0-2010-42c2-8d5c-b14b0ab35dd1";

let business = null;
let currentTicket = null;
let waitingTickets = [];
let services = [];
let currentUser = null;


// ==========================================
// PROTEGER TEXTO PARA HTML
// ==========================================

function escapeHTML(value) {

    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}


// ==========================================
// MOSTRAR LOGIN
// ==========================================

function showLogin(message = "") {

    if (loginApp) {
        loginApp.style.display = "block";
    }

    if (adminApp) {
        adminApp.style.display = "none";
    }

    connectionStatus.textContent = "INICIAR SESIÓN";

    if (loginMessage) {
        loginMessage.textContent = message;
    }
}


// ==========================================
// MOSTRAR PANEL
// ==========================================

function showAdminPanel() {

    if (loginApp) {
        loginApp.style.display = "none";
    }

    if (adminApp) {
        adminApp.style.display = "block";
    }
}


// ==========================================
// LOGIN
// ==========================================

async function loginAdmin(event) {

    event.preventDefault();

    const email =
        loginEmail.value.trim();

    const password =
        loginPassword.value;

    if (!email || !password) {

        loginMessage.textContent =
            "Debes escribir correo y contraseña.";

        return;
    }


    loginButton.disabled = true;

    loginButton.textContent =
        "🔄 Iniciando sesión...";

    loginMessage.textContent =
        "";


    try {

        const { data, error } =
            await client.auth.signInWithPassword({
                email: email,
                password: password
            });


        if (error) {
            throw error;
        }


        currentUser =
            data.user;


        if (!currentUser) {
            throw new Error(
                "No se pudo obtener el usuario."
            );
        }


        await loadBusiness();


    } catch (error) {

        console.error(
            "ERROR LOGIN:",
            error
        );

        loginMessage.textContent =
            "❌ " + error.message;


        loginButton.disabled = false;

        loginButton.textContent =
            "🔐 Iniciar sesión";
    }
}


// ==========================================
// COMPROBAR QUE EL USUARIO PERTENECE
// A LA BARBERÍA
// ==========================================

async function verifyBusinessMember() {

    if (!business || !currentUser) {
        return false;
    }


    const { data, error } =
        await client.rpc(
            "is_business_member",
            {
                bid: business.id
            }
        );


    if (error) {

        console.error(
            "ERROR VERIFICANDO MIEMBRO:",
            error
        );

        throw error;
    }


    return data === true;
}


// ==========================================
// CARGAR BARBERÍA
// ==========================================

async function loadBusiness() {

    connectionStatus.textContent =
        "CONECTANDO...";


    try {

        const { data, error } =
            await client.rpc(
                "get_business_by_qr",
                {
                    p_qr_slug:
                        "barberia-el-jefe"
                }
            );


        if (error) {
            throw error;
        }


        if (!data || data.length === 0) {

            throw new Error(
                "No se encontró la barbería."
            );
        }


        business =
            data[0];


        businessInfo.textContent =
            `${business.name} · ${business.city || ""}`;


        // ======================================
        // VERIFICAR MEMBRESÍA
        // ======================================

        const isMember =
            await verifyBusinessMember();


        if (!isMember) {

            await client.auth.signOut();


            currentUser = null;
            business = null;


            throw new Error(
                "Este usuario no está autorizado para administrar esta barbería."
            );
        }


        connectionStatus.textContent =
            "ONLINE";


        showAdminPanel();


        await loadPanel();


    } catch (error) {

        console.error(
            "ERROR ADMIN:",
            error
        );


        connectionStatus.textContent =
            "ERROR";


        if (loginApp) {

            showLogin(
                "❌ " + error.message
            );

        }
    }
}


// ==========================================
// CARGAR PANEL
// ==========================================

async function loadPanel() {

    if (!business || !currentUser) {
        return;
    }


    await loadCurrentTicket();

    await loadWaitingTickets();

    await loadServices();

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
                p_business_id:
                    business.id
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
                p_business_id:
                    business.id
            }
        );


    if (error) {

        console.error(error);

        waitingTickets = [];

        return;
    }


    waitingTickets =
        data || [];
}


// ==========================================
// SERVICIOS
// ==========================================

async function loadServices() {

    const { data, error } =
        await client
            .from("services")
            .select("*")
            .eq(
                "business_id",
                business.id
            )
            .order(
                "active",
                {
                    ascending: false
                }
            )
            .order(
                "name",
                {
                    ascending: true
                }
            );


    if (error) {

        console.error(
            "ERROR CARGANDO SERVICIOS:",
            error
        );

        services = [];

        return;
    }


    services =
        data || [];
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
                        ${escapeHTML(
                            currentTicket.ticket_code
                        )}
                    </div>

                    <h2>
                        ${escapeHTML(
                            currentTicket.service_name
                        )}
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
                    ${waitingTickets.length}
                    esperando
                </span>

            </div>


            ${
                waitingTickets.length === 0
                ?
                `
                <div class="empty">

                    <p>
                        No hay clientes esperando.
                    </p>

                </div>
                `
                :
                `
                <div class="queue">

                    ${
                        waitingTickets
                            .map(
                                (ticket, index) => `

                                <div class="queue-item">

                                    <div>

                                        <strong>
                                            ${escapeHTML(
                                                ticket.ticket_code
                                            )}
                                        </strong>

                                        <span>
                                            ${escapeHTML(
                                                ticket.service_name
                                            )}
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

                            `
                            )
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


        <!-- =====================================
             SERVICIOS
        ====================================== -->

        <section class="card services-admin">

            <div class="queue-header">

                <h2>🛠️ SERVICIOS</h2>

                <button
                    class="btn primary"
                    onclick="createService()"
                >
                    ➕ Nuevo servicio
                </button>

            </div>


            ${
                services.length === 0
                ?
                `
                <div class="empty">

                    <p>
                        No hay servicios configurados.
                    </p>

                </div>
                `
                :
                `
                <div class="queue">

                    ${
                        services
                            .map(
                                service => `

                                <div class="queue-item">

                                    <div>

                                        <strong>
                                            ${escapeHTML(
                                                service.name
                                            )}
                                        </strong>

                                        <span>
                                            ${
                                                service.duration_minutes
                                            }
                                            min
                                            ·
                                            $${Number(
                                                service.price
                                            ).toLocaleString(
                                                "es-CO"
                                            )}
                                        </span>

                                        <small>
                                            ${
                                                service.active
                                                ? "🟢 Activo"
                                                : "⚪ Inactivo"
                                            }
                                        </small>

                                    </div>


                                    <div class="actions">

                                        <button
                                            class="btn"
                                            onclick="editService('${service.id}')"
                                        >
                                            ✏️ Editar
                                        </button>


                                        <button
                                            class="btn ${
                                                service.active
                                                ? "danger"
                                                : "success"
                                            }"
                                            onclick="toggleService(
                                                '${service.id}',
                                                ${service.active}
                                            )"
                                        >

                                            ${
                                                service.active
                                                ? "⛔ Desactivar"
                                                : "🟢 Activar"
                                            }

                                        </button>

                                    </div>

                                </div>

                            `
                            )
                            .join("")
                    }

                </div>
                `
            }

        </section>


        <section class="card">

            <button
                class="btn danger"
                onclick="logoutAdmin()"
            >
                🚪 Cerrar sesión
            </button>

        </section>

    `;
}


// ==========================================
// CREAR SERVICIO
// ==========================================

async function createService() {

    const name =
        prompt(
            "Nombre del nuevo servicio:"
        );


    if (name === null) {
        return;
    }


    const cleanName =
        name.trim();


    if (!cleanName) {

        alert(
            "Debes escribir un nombre."
        );

        return;
    }


    const priceInput =
        prompt(
            "Precio del servicio en pesos:"
        );


    if (priceInput === null) {
        return;
    }


    const price =
        Number(
            priceInput
                .replace(/\./g, "")
                .replace(/,/g, ".")
        );


    if (
        !Number.isFinite(price) ||
        price < 0
    ) {

        alert(
            "El precio no es válido."
        );

        return;
    }


    const durationInput =
        prompt(
            "Duración en minutos:"
        );


    if (durationInput === null) {
        return;
    }


    const duration =
        Number(durationInput);


    if (
        !Number.isInteger(duration) ||
        duration <= 0
    ) {

        alert(
            "La duración debe ser un número entero mayor que 0."
        );

        return;
    }


    const { error } =
        await client
            .from("services")
            .insert({

                business_id:
                    business.id,

                name:
                    cleanName,

                price:
                    price,

                duration_minutes:
                    duration,

                active:
                    true
            });


    if (error) {

        console.error(
            "ERROR CREANDO SERVICIO:",
            error
        );


        alert(
            "No se pudo crear el servicio:\n\n" +
            error.message
        );


        return;
    }


    alert(
        "✅ Servicio creado correctamente."
    );


    await loadPanel();
}


// ==========================================
// EDITAR SERVICIO
// ==========================================

async function editService(
    serviceId
) {

    const service =
        services.find(
            item =>
                item.id === serviceId
        );


    if (!service) {

        alert(
            "No se encontró el servicio."
        );

        return;
    }


    const name =
        prompt(
            "Nombre del servicio:",
            service.name
        );


    if (name === null) {
        return;
    }


    const cleanName =
        name.trim();


    if (!cleanName) {

        alert(
            "El nombre no puede estar vacío."
        );

        return;
    }


    const priceInput =
        prompt(
            "Precio en pesos:",
            Number(service.price)
        );


    if (priceInput === null) {
        return;
    }


    const price =
        Number(
            priceInput
                .replace(/\./g, "")
                .replace(/,/g, ".")
        );


    if (
        !Number.isFinite(price) ||
        price < 0
    ) {

        alert(
            "El precio no es válido."
        );

        return;
    }


    const durationInput =
        prompt(
            "Duración en minutos:",
            service.duration_minutes
        );


    if (durationInput === null) {
        return;
    }


    const duration =
        Number(durationInput);


    if (
        !Number.isInteger(duration) ||
        duration <= 0
    ) {

        alert(
            "La duración debe ser un número entero mayor que 0."
        );

        return;
    }


    const { error } =
        await client
            .from("services")
            .update({

                name:
                    cleanName,

                price:
                    price,

                duration_minutes:
                    duration

            })
            .eq(
                "id",
                serviceId
            )
            .eq(
                "business_id",
                business.id
            );


    if (error) {

        console.error(
            "ERROR EDITANDO SERVICIO:",
            error
        );


        alert(
            "No se pudo editar el servicio:\n\n" +
            error.message
        );


        return;
    }


    alert(
        "✅ Servicio actualizado."
    );


    await loadPanel();
}


// ==========================================
// ACTIVAR / DESACTIVAR SERVICIO
// ==========================================

async function toggleService(
    serviceId,
    currentActive
) {

    const service =
        services.find(
            item =>
                item.id === serviceId
        );


    if (!service) {
        return;
    }


    const action =
        currentActive
        ? "desactivar"
        : "activar";


    const confirmed =
        confirm(
            `¿Quieres ${action} "${service.name}"?`
        );


    if (!confirmed) {
        return;
    }


    const { error } =
        await client
            .from("services")
            .update({

                active:
                    !currentActive

            })
            .eq(
                "id",
                serviceId
            )
            .eq(
                "business_id",
                business.id
            );


    if (error) {

        console.error(
            "ERROR CAMBIANDO SERVICIO:",
            error
        );


        alert(
            "No se pudo cambiar el estado:\n\n" +
            error.message
        );


        return;
    }


    await loadPanel();
}


// ==========================================
// LLAMAR SIGUIENTE
// ==========================================

async function callNext() {

    if (currentTicket) {

        alert(
            "Primero debes finalizar el turno actual."
        );

        return;
    }


    const { data, error } =
        await client.rpc(
            "admin_call_next",
            {
                p_business_id:
                    business.id
            }
        );


    if (error) {

        alert(
            error.message
        );

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

    if (!currentTicket) {
        return;
    }


    const { data, error } =
        await client.rpc(
            "admin_finish_ticket",
            {
                p_ticket_id:
                    currentTicket.id
            }
        );


    if (error) {

        alert(
            error.message
        );

        return;
    }


    if (!data) {

        alert(
            "No se pudo finalizar el turno."
        );

        return;
    }


    currentTicket =
        null;


    await loadPanel();
}


// ==========================================
// NO SE PRESENTÓ
// ==========================================

async function noShowCurrent() {

    if (!currentTicket) {
        return;
    }


    const { data, error } =
        await client.rpc(
            "admin_no_show_ticket",
            {
                p_ticket_id:
                    currentTicket.id
            }
        );


    if (error) {

        alert(
            error.message
        );

        return;
    }


    if (!data) {

        alert(
            "No se pudo cambiar el estado."
        );

        return;
    }


    currentTicket =
        null;


    await loadPanel();
}


// ==========================================
// CERRAR SESIÓN
// ==========================================

async function logoutAdmin() {

    const confirmed =
        confirm(
            "¿Quieres cerrar sesión?"
        );


    if (!confirmed) {
        return;
    }


    const { error } =
        await client.auth.signOut();


    if (error) {

        alert(
            "No se pudo cerrar sesión:\n\n" +
            error.message
        );

        return;
    }


    currentUser = null;
    business = null;
    currentTicket = null;
    waitingTickets = [];
    services = [];


    showLogin(
        "Sesión cerrada correctamente."
    );
}


// ==========================================
// ACTUALIZACIÓN AUTOMÁTICA
// ==========================================

setInterval(
    async function () {

        if (
            currentUser &&
            business
        ) {

            await loadPanel();

        }

    },
    10000
);


// ==========================================
// DETECTAR CAMBIOS DE SESIÓN
// ==========================================

client.auth.onAuthStateChange(
    async function (
        event,
        session
    ) {

        console.log(
            "AUTH:",
            event
        );


        if (
            session &&
            session.user
        ) {

            currentUser =
                session.user;


            if (!business) {

                await loadBusiness();

            }

        } else {

            currentUser =
                null;

            business =
                null;

            currentTicket =
                null;

            waitingTickets =
                [];

            services =
                [];


            showLogin();
        }

    }
);


// ==========================================
// FORMULARIO DE LOGIN
// ==========================================

if (loginForm) {

    loginForm.addEventListener(
        "submit",
        loginAdmin
    );

}


// ==========================================
// INICIAR
// ==========================================

async function initAdmin() {

    try {

        const {
            data,
            error
        } =
            await client.auth.getSession();


        if (error) {
            throw error;
        }


        if (
            data &&
            data.session &&
            data.session.user
        ) {

            currentUser =
                data.session.user;


            await loadBusiness();

        } else {

            showLogin();

        }

    } catch (error) {

        console.error(
            "ERROR INICIANDO ADMIN:",
            error
        );


        showLogin(
            "❌ " + error.message
        );
    }
}


initAdmin();

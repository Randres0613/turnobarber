const adminApp =
    document.getElementById("adminApp");

const businessInfo =
    document.getElementById("businessInfo");

const connectionStatus =
    document.getElementById("connectionStatus");


let business = null;

let currentTicket = null;

let waitingTickets = [];

let myServices = [];

let myBarbers = [];


// ==========================================
// VERIFICAR SESIÓN
// ==========================================

async function checkSession() {

    const {
        data,
        error
    } = await client.auth.getSession();


    if (error) {

        console.error(
            "ERROR OBTENIENDO SESIÓN:",
            error
        );

        return false;

    }


    if (
        !data ||
        !data.session ||
        !data.session.user
    ) {

        window.location.href =
            "login.html";

        return false;

    }


    return true;

}


// ==========================================
// MOSTRAR CREAR BARBERÍA
// ==========================================

function showCreateBusiness() {

    connectionStatus.textContent =
        "CONFIGURAR";


    businessInfo.textContent =
        "Configura tu barbería";


    adminApp.innerHTML = `

        <section
            class="card hero"
            style="max-width: 650px; margin: 30px auto;"
        >

            <h2>
                🏪 Crea tu barbería
            </h2>


            <p>
                Tu cuenta está confirmada, pero todavía
                no tienes una barbería asociada.
            </p>


            <p>
                Completa los datos para comenzar a utilizar
                TurnoBarber.
            </p>


            <form
                id="createBusinessForm"
                style="margin-top: 25px;"
            >

                <div style="margin-bottom: 18px;">

                    <label for="businessName">
                        Nombre de la barbería
                    </label>

                    <input
                        id="businessName"
                        type="text"
                        placeholder="Ej. Barbería El Jefe"
                        required
                        maxlength="100"
                        style="
                            width: 100%;
                            box-sizing: border-box;
                            padding: 12px;
                            margin-top: 6px;
                        "
                    >

                </div>


                <div style="margin-bottom: 18px;">

                    <label for="businessCity">
                        Ciudad
                    </label>

                    <input
                        id="businessCity"
                        type="text"
                        placeholder="Ej. Cartagena"
                        required
                        maxlength="100"
                        style="
                            width: 100%;
                            box-sizing: border-box;
                            padding: 12px;
                            margin-top: 6px;
                        "
                    >

                </div>


                <div style="margin-bottom: 18px;">

                    <label for="businessPhone">
                        Teléfono
                    </label>

                    <input
                        id="businessPhone"
                        type="tel"
                        placeholder="Ej. 3001234567"
                        maxlength="30"
                        style="
                            width: 100%;
                            box-sizing: border-box;
                            padding: 12px;
                            margin-top: 6px;
                        "
                    >

                </div>


                <button
                    id="createBusinessButton"
                    type="submit"
                    class="btn primary big"
                    style="width: 100%;"
                >
                    🏪 Crear mi barbería
                </button>


                <p
                    id="createBusinessMessage"
                    style="margin-top: 15px;"
                ></p>

            </form>


            <button
                class="btn"
                onclick="logout()"
                style="
                    width: 100%;
                    margin-top: 15px;
                "
            >
                🚪 Cerrar sesión
            </button>

        </section>

    `;


    const form =
        document.getElementById(
            "createBusinessForm"
        );


    form.addEventListener(
        "submit",
        createBusiness
    );

}


// ==========================================
// CREAR BARBERÍA
// ==========================================

async function createBusiness(event) {

    event.preventDefault();


    const name =
        document
            .getElementById("businessName")
            .value
            .trim();


    const city =
        document
            .getElementById("businessCity")
            .value
            .trim();


    const phone =
        document
            .getElementById("businessPhone")
            .value
            .trim();


    const button =
        document.getElementById(
            "createBusinessButton"
        );


    const message =
        document.getElementById(
            "createBusinessMessage"
        );


    if (!name) {

        message.textContent =
            "⚠️ Escribe el nombre de la barbería.";

        return;

    }


    if (!city) {

        message.textContent =
            "⚠️ Escribe la ciudad.";

        return;

    }


    button.disabled =
        true;


    button.textContent =
        "⏳ Creando barbería...";


    message.textContent =
        "";


    try {

        const {
            data,
            error
        } =
            await client.rpc(
                "create_business_for_current_user",
                {
                    p_business_name:
                        name,

                    p_city:
                        city,

                    p_phone:
                        phone || null
                }
            );


        if (error) {

            throw error;

        }


        if (
            !data ||
            data.length === 0
        ) {

            throw new Error(
                "No se pudo crear la barbería."
            );

        }


        message.textContent =
            "✅ Barbería creada correctamente.";


        button.textContent =
            "✅ Barbería creada";


        setTimeout(
            async function() {

                await loadBusiness();

            },
            700
        );


    } catch (error) {

        console.error(
            "ERROR CREANDO BARBERÍA:",
            error
        );


        message.textContent =
            "❌ " + error.message;


        button.disabled =
            false;


        button.textContent =
            "🏪 Crear mi barbería";

    }

}


// ==========================================
// CARGAR BARBERÍA DEL USUARIO
// ==========================================

async function loadBusiness() {

    connectionStatus.textContent =
        "CONECTANDO...";


    try {

        const {
            data,
            error
        } =
            await client.rpc(
                "get_my_business"
            );


        if (error) {

            throw error;

        }


        if (
            !data ||
            data.length === 0
        ) {

            showCreateBusiness();

            return;

        }


        business =
            data[0];


        if (
            business.role &&
            business.role !== "owner"
        ) {

            throw new Error(
                "Tu cuenta no tiene permisos de administrador."
            );

        }


        businessInfo.textContent =
            `${business.name} · ${business.city || ""}`;


        connectionStatus.textContent =
            "ONLINE";


        await loadPanel();


    } catch (error) {

        console.error(
            "ERROR ADMIN:",
            error
        );


        connectionStatus.textContent =
            "ERROR";


        adminApp.innerHTML = `

            <div class="card hero">

                <h2>
                    ⚠️ Error cargando el panel
                </h2>


                <p>
                    ${escapeHtml(error.message)}
                </p>


                <button
                    class="btn"
                    onclick="location.reload()"
                >
                    🔄 Reintentar
                </button>


                <button
                    class="btn"
                    onclick="logout()"
                    style="margin-top: 10px;"
                >
                    🚪 Cerrar sesión
                </button>

            </div>

        `;

    }

}


// ==========================================
// CARGAR PANEL
// ==========================================

async function loadPanel() {

    if (!business) {

        return;

    }


    await loadCurrentTicket();

    await loadWaitingTickets();

    await loadServices();

    await loadBarbers();

    renderPanel();

}


// ==========================================
// TURNO ACTUAL
// ==========================================

async function loadCurrentTicket() {

    const {
        data,
        error
    } =
        await client.rpc(
            "admin_current_ticket",
            {
                p_business_id:
                    business.id
            }
        );


    if (error) {

        console.error(
            "ERROR TURNO ACTUAL:",
            error
        );

        currentTicket =
            null;

        return;

    }


    currentTicket =
        data &&
        data.length > 0
            ? data[0]
            : null;

}


// ==========================================
// TURNOS EN ESPERA
// ==========================================

async function loadWaitingTickets() {

    const {
        data,
        error
    } =
        await client.rpc(
            "admin_waiting_tickets",
            {
                p_business_id:
                    business.id
            }
        );


    if (error) {

        console.error(
            "ERROR TURNOS EN ESPERA:",
            error
        );

        waitingTickets =
            [];

        return;

    }


    waitingTickets =
        data || [];

}


// ==========================================
// CARGAR MIS SERVICIOS
// ==========================================

async function loadServices() {

    const {
        data,
        error
    } =
        await client.rpc(
            "admin_my_services"
        );


    if (error) {

        console.error(
            "ERROR CARGANDO SERVICIOS:",
            error
        );

        myServices =
            [];

        return;

    }


    myServices =
        data || [];

}


// ==========================================
// CARGAR MIS BARBEROS
// ==========================================

async function loadBarbers() {

    const {
        data,
        error
    } =
        await client.rpc(
            "admin_my_barbers"
        );


    if (error) {

        console.error(
            "ERROR CARGANDO BARBEROS:",
            error
        );

        myBarbers =
            [];

        return;

    }


    myBarbers =
        data || [];

}


// ==========================================
// MOSTRAR PANEL
// ==========================================

function renderPanel() {

    adminApp.innerHTML = `

        <section class="card current">

            <h2>
                TURNO ACTUAL
            </h2>


            ${
                currentTicket

                ?

                `
                <div class="current-ticket">

                    <div class="ticket-number">
                        ${escapeHtml(
                            currentTicket.ticket_code
                        )}
                    </div>


                    <h2>
                        ${escapeHtml(
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

                <h2>
                    PRÓXIMOS TURNOS
                </h2>


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
                                (
                                    ticket,
                                    index
                                ) => `

                                    <div
                                        class="queue-item"
                                    >

                                        <div>

                                            <strong>
                                                ${escapeHtml(
                                                    ticket.ticket_code
                                                )}
                                            </strong>


                                            <span>
                                                ${escapeHtml(
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


        ${renderBarbers()}


        ${renderServices()}


        <button
            class="btn primary big"
            onclick="callNext()"
            ${currentTicket ? "disabled" : ""}
        >
            📢 Llamar siguiente
        </button>


        <button
            class="btn"
            onclick="logout()"
            style="margin-top: 10px;"
        >
            🚪 Cerrar sesión
        </button>

    `;

}


// ==========================================
// RENDERIZAR BARBEROS
// ==========================================

function renderBarbers() {

    return `

        <section class="card">

            <div class="queue-header">

                <h2>
                    👨‍💼 MIS BARBEROS
                </h2>


                <span class="badge">
                    ${myBarbers.length}
                    barberos
                </span>

            </div>


            <button
                class="btn primary"
                onclick="showCreateBarberForm()"
            >
                ➕ Nuevo barbero
            </button>


            <div
                id="barberFormContainer"
                style="margin-top: 20px;"
            ></div>


            <div style="margin-top: 20px;">

                ${
                    myBarbers.length === 0

                    ?

                    `
                    <div class="empty">

                        <p>
                            Todavía no tienes barberos.
                        </p>


                        <p>
                            Crea el primero para comenzar
                            a organizar tu equipo.
                        </p>

                    </div>
                    `

                    :

                    `
                    <div class="queue">

                        ${
                            myBarbers
                                .map(
                                    barber => `

                                        <div
                                            class="queue-item"
                                            style="
                                                margin-bottom: 10px;
                                            "
                                        >

                                            <div>

                                                <strong>
                                                    👤
                                                    ${escapeHtml(
                                                        barber.name
                                                    )}
                                                </strong>


                                                <span>

                                                    ${
                                                        barber.active
                                                            ? "🟢 Activo"
                                                            : "🔴 Inactivo"
                                                    }

                                                </span>

                                            </div>


                                            <div
                                                style="
                                                    display: flex;
                                                    gap: 6px;
                                                    flex-wrap: wrap;
                                                    justify-content: flex-end;
                                                "
                                            >

                                                ${
                                                    barber.active

                                                    ?

                                                    `
                                                    <button
                                                        class="btn success"
                                                        onclick="toggleBarber(
                                                            '${barber.id}',
                                                            false
                                                        )"
                                                    >
                                                        🟢 Activo
                                                    </button>
                                                    `

                                                    :

                                                    `
                                                    <button
                                                        class="btn danger"
                                                        onclick="toggleBarber(
                                                            '${barber.id}',
                                                            true
                                                        )"
                                                    >
                                                        🔴 Inactivo
                                                    </button>
                                                    `
                                                }


                                                <button
                                                    class="btn"
                                                    onclick="showEditBarberForm(
                                                        '${barber.id}'
                                                    )"
                                                >
                                                    ✏️ Editar
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

            </div>

        </section>

    `;

}


// ==========================================
// FORMULARIO NUEVO BARBERO
// ==========================================

function showCreateBarberForm() {

    const container =
        document.getElementById(
            "barberFormContainer"
        );


    if (!container) {

        return;

    }


    container.innerHTML = `

        <div class="card">

            <h3>
                ➕ Nuevo barbero
            </h3>


            <div style="margin-bottom: 10px;">

                <label>
                    Nombre del barbero
                </label>


                <input
                    id="newBarberName"
                    type="text"
                    placeholder="Ej. Andrés"
                    maxlength="100"
                    style="
                        width: 100%;
                        box-sizing: border-box;
                        padding: 12px;
                        margin-top: 5px;
                    "
                >

            </div>


            <button
                class="btn primary"
                onclick="createBarber()"
            >
                💾 Guardar barbero
            </button>


            <button
                class="btn"
                onclick="closeBarberForm()"
                style="margin-top: 5px;"
            >
                Cancelar
            </button>


            <p
                id="barberFormMessage"
                style="margin-top: 10px;"
            ></p>

        </div>

    `;

}


// ==========================================
// CERRAR FORMULARIO BARBERO
// ==========================================

function closeBarberForm() {

    const container =
        document.getElementById(
            "barberFormContainer"
        );


    if (container) {

        container.innerHTML =
            "";

    }

}


// ==========================================
// CREAR BARBERO
// ==========================================

async function createBarber() {

    const nameElement =
        document.getElementById(
            "newBarberName"
        );


    const message =
        document.getElementById(
            "barberFormMessage"
        );


    if (
        !nameElement ||
        !message
    ) {

        return;

    }


    const name =
        nameElement.value.trim();


    if (!name) {

        message.textContent =
            "⚠️ Escribe el nombre del barbero.";

        return;

    }


    message.textContent =
        "⏳ Creando barbero...";


    const {
        data,
        error
    } =
        await client.rpc(
            "admin_create_barber",
            {
                p_name:
                    name
            }
        );


    if (error) {

        console.error(
            "ERROR CREANDO BARBERO:",
            error
        );


        message.textContent =
            "❌ " + error.message;

        return;

    }


    if (
        !data ||
        data.length === 0
    ) {

        message.textContent =
            "❌ No se pudo crear el barbero.";

        return;

    }


    await loadBarbers();

    renderPanel();

}


// ==========================================
// FORMULARIO EDITAR BARBERO
// ==========================================

function showEditBarberForm(
    barberId
) {

    const barber =
        myBarbers.find(
            b => b.id === barberId
        );


    if (!barber) {

        alert(
            "No se encontró el barbero."
        );

        return;

    }


    const container =
        document.getElementById(
            "barberFormContainer"
        );


    if (!container) {

        return;

    }


    container.innerHTML = `

        <div class="card">

            <h3>
                ✏️ Editar barbero
            </h3>


            <div style="margin-bottom: 10px;">

                <label>
                    Nombre
                </label>


                <input
                    id="editBarberName"
                    type="text"
                    value="${escapeHtml(
                        barber.name
                    )}"
                    maxlength="100"
                    style="
                        width: 100%;
                        box-sizing: border-box;
                        padding: 12px;
                        margin-top: 5px;
                    "
                >

            </div>


            <button
                class="btn primary"
                onclick="updateBarber(
                    '${barber.id}'
                )"
            >
                💾 Guardar cambios
            </button>


            <button
                class="btn"
                onclick="closeBarberForm()"
                style="margin-top: 5px;"
            >
                Cancelar
            </button>


            <p
                id="barberFormMessage"
                style="margin-top: 10px;"
            ></p>

        </div>

    `;

}


// ==========================================
// ACTUALIZAR BARBERO
// ==========================================

async function updateBarber(
    barberId
) {

    const nameElement =
        document.getElementById(
            "editBarberName"
        );


    const message =
        document.getElementById(
            "barberFormMessage"
        );


    if (
        !nameElement ||
        !message
    ) {

        return;

    }


    const name =
        nameElement.value.trim();


    if (!name) {

        message.textContent =
            "⚠️ Escribe el nombre.";

        return;

    }


    message.textContent =
        "⏳ Guardando cambios...";


    const {
        data,
        error
    } =
        await client.rpc(
            "admin_update_barber",
            {
                p_barber_id:
                    barberId,

                p_name:
                    name
            }
        );


    if (error) {

        console.error(
            "ERROR ACTUALIZANDO BARBERO:",
            error
        );


        message.textContent =
            "❌ " + error.message;

        return;

    }


    if (!data) {

        message.textContent =
            "❌ No se pudo actualizar.";

        return;

    }


    await loadBarbers();

    renderPanel();

}


// ==========================================
// ACTIVAR / DESACTIVAR BARBERO
// ==========================================

async function toggleBarber(
    barberId,
    active
) {

    const action =
        active
            ? "activar"
            : "desactivar";


    const confirmed =
        confirm(
            `¿Quieres ${action} este barbero?`
        );


    if (!confirmed) {

        return;

    }


    const {
        data,
        error
    } =
        await client.rpc(
            "admin_toggle_barber",
            {
                p_barber_id:
                    barberId,

                p_active:
                    active
            }
        );


    if (error) {

        console.error(
            "ERROR CAMBIANDO BARBERO:",
            error
        );


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


    await loadBarbers();

    renderPanel();

}


// ==========================================
// RENDERIZAR SERVICIOS
// ==========================================

function renderServices() {

    return `

        <section class="card">

            <div class="queue-header">

                <h2>
                    ⚙️ MIS SERVICIOS
                </h2>


                <span class="badge">
                    ${myServices.length}
                    servicios
                </span>

            </div>


            <button
                class="btn primary"
                onclick="showCreateServiceForm()"
            >
                ➕ Nuevo servicio
            </button>


            <div
                id="serviceFormContainer"
                style="margin-top: 20px;"
            ></div>


            <div style="margin-top: 20px;">

                ${
                    myServices.length === 0

                    ?

                    `
                    <div class="empty">

                        <p>
                            Todavía no tienes servicios.
                        </p>


                        <p>
                            Crea el primero para que tus
                            clientes puedan tomar turnos.
                        </p>

                    </div>
                    `

                    :

                    `
                    <div class="queue">

                        ${
                            myServices
                                .map(
                                    service => `

                                        <div
                                            class="queue-item"
                                            style="
                                                margin-bottom: 10px;
                                            "
                                        >

                                            <div>

                                                <strong>
                                                    ${escapeHtml(
                                                        service.name
                                                    )}
                                                </strong>


                                                <span>

                                                    $${Number(
                                                        service.price || 0
                                                    ).toLocaleString(
                                                        "es-CO"
                                                    )}

                                                    ·

                                                    ${service.duration_minutes}
                                                    min

                                                </span>

                                            </div>


                                            <div
                                                style="
                                                    display: flex;
                                                    gap: 6px;
                                                    flex-wrap: wrap;
                                                    justify-content: flex-end;
                                                "
                                            >

                                                ${
                                                    service.active

                                                    ?

                                                    `
                                                    <button
                                                        class="btn success"
                                                        onclick="toggleService(
                                                            '${service.id}',
                                                            false
                                                        )"
                                                    >
                                                        🟢 Activo
                                                    </button>
                                                    `

                                                    :

                                                    `
                                                    <button
                                                        class="btn danger"
                                                        onclick="toggleService(
                                                            '${service.id}',
                                                            true
                                                        )"
                                                    >
                                                        🔴 Inactivo
                                                    </button>
                                                    `
                                                }


                                                <button
                                                    class="btn"
                                                    onclick="showEditServiceForm(
                                                        '${service.id}'
                                                    )"
                                                >
                                                    ✏️ Editar
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

            </div>

        </section>

    `;

}


// ==========================================
// ESCAPAR TEXTO
// ==========================================

function escapeHtml(value) {

    return String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");

}


// ==========================================
// FORMULARIO NUEVO SERVICIO
// ==========================================

function showCreateServiceForm() {

    const container =
        document.getElementById(
            "serviceFormContainer"
        );


    if (!container) {

        return;

    }


    container.innerHTML = `

        <div class="card">

            <h3>
                ➕ Nuevo servicio
            </h3>


            <div style="margin-bottom: 10px;">

                <label>
                    Nombre
                </label>


                <input
                    id="newServiceName"
                    type="text"
                    placeholder="Ej. Corte"
                    maxlength="100"
                    style="
                        width: 100%;
                        box-sizing: border-box;
                        padding: 12px;
                        margin-top: 5px;
                    "
                >

            </div>


            <div style="margin-bottom: 10px;">

                <label>
                    Precio
                </label>


                <input
                    id="newServicePrice"
                    type="number"
                    min="0"
                    step="100"
                    placeholder="Ej. 20000"
                    style="
                        width: 100%;
                        box-sizing: border-box;
                        padding: 12px;
                        margin-top: 5px;
                    "
                >

            </div>


            <div style="margin-bottom: 10px;">

                <label>
                    Duración en minutos
                </label>


                <input
                    id="newServiceDuration"
                    type="number"
                    min="1"
                    max="480"
                    placeholder="Ej. 30"
                    style="
                        width: 100%;
                        box-sizing: border-box;
                        padding: 12px;
                        margin-top: 5px;
                    "
                >

            </div>


            <button
                class="btn primary"
                onclick="createService()"
            >
                💾 Guardar servicio
            </button>


            <button
                class="btn"
                onclick="closeServiceForm()"
                style="margin-top: 5px;"
            >
                Cancelar
            </button>


            <p
                id="serviceFormMessage"
                style="margin-top: 10px;"
            ></p>

        </div>

    `;

}


// ==========================================
// CERRAR FORMULARIO SERVICIO
// ==========================================

function closeServiceForm() {

    const container =
        document.getElementById(
            "serviceFormContainer"
        );


    if (container) {

        container.innerHTML =
            "";

    }

}


// ==========================================
// CREAR SERVICIO
// ==========================================

async function createService() {

    const nameElement =
        document.getElementById(
            "newServiceName"
        );


    const priceElement =
        document.getElementById(
            "newServicePrice"
        );


    const durationElement =
        document.getElementById(
            "newServiceDuration"
        );


    const message =
        document.getElementById(
            "serviceFormMessage"
        );


    if (
        !nameElement ||
        !priceElement ||
        !durationElement ||
        !message
    ) {

        return;

    }


    const name =
        nameElement.value.trim();


    const price =
        Number(priceElement.value);


    const duration =
        Number(durationElement.value);


    if (!name) {

        message.textContent =
            "⚠️ Escribe el nombre del servicio.";

        return;

    }


    if (
        !Number.isFinite(price) ||
        price < 0
    ) {

        message.textContent =
            "⚠️ Escribe un precio válido.";

        return;

    }


    if (
        !Number.isInteger(duration) ||
        duration <= 0 ||
        duration > 480
    ) {

        message.textContent =
            "⚠️ La duración debe estar entre 1 y 480 minutos.";

        return;

    }


    message.textContent =
        "⏳ Creando servicio...";


    const {
        data,
        error
    } =
        await client.rpc(
            "admin_create_service",
            {
                p_name:
                    name,

                p_price:
                    price,

                p_duration_minutes:
                    duration
            }
        );


    if (error) {

        console.error(
            "ERROR CREANDO SERVICIO:",
            error
        );


        message.textContent =
            "❌ " + error.message;

        return;

    }


    if (
        !data ||
        data.length === 0
    ) {

        message.textContent =
            "❌ No se pudo crear el servicio.";

        return;

    }


    await loadServices();

    renderPanel();

}


// ==========================================
// FORMULARIO EDITAR SERVICIO
// ==========================================

function showEditServiceForm(
    serviceId
) {

    const service =
        myServices.find(
            s => s.id === serviceId
        );


    if (!service) {

        alert(
            "No se encontró el servicio."
        );

        return;

    }


    const container =
        document.getElementById(
            "serviceFormContainer"
        );


    if (!container) {

        return;

    }


    container.innerHTML = `

        <div class="card">

            <h3>
                ✏️ Editar servicio
            </h3>


            <div style="margin-bottom: 10px;">

                <label>
                    Nombre
                </label>


                <input
                    id="editServiceName"
                    type="text"
                    value="${escapeHtml(
                        service.name
                    )}"
                    maxlength="100"
                    style="
                        width: 100%;
                        box-sizing: border-box;
                        padding: 12px;
                        margin-top: 5px;
                    "
                >

            </div>


            <div style="margin-bottom: 10px;">

                <label>
                    Precio
                </label>


                <input
                    id="editServicePrice"
                    type="number"
                    min="0"
                    step="100"
                    value="${service.price ?? 0}"
                    style="
                        width: 100%;
                        box-sizing: border-box;
                        padding: 12px;
                        margin-top: 5px;
                    "
                >

            </div>


            <div style="margin-bottom: 10px;">

                <label>
                    Duración en minutos
                </label>


                <input
                    id="editServiceDuration"
                    type="number"
                    min="1"
                    max="480"
                    value="${service.duration_minutes ?? 30}"
                    style="
                        width: 100%;
                        box-sizing: border-box;
                        padding: 12px;
                        margin-top: 5px;
                    "
                >

            </div>


            <button
                class="btn primary"
                onclick="updateService(
                    '${service.id}'
                )"
            >
                💾 Guardar cambios
            </button>


            <button
                class="btn"
                onclick="closeServiceForm()"
                style="margin-top: 5px;"
            >
                Cancelar
            </button>


            <p
                id="serviceFormMessage"
                style="margin-top: 10px;"
            ></p>

        </div>

    `;

}


// ==========================================
// ACTUALIZAR SERVICIO
// ==========================================

async function updateService(
    serviceId
) {

    const nameElement =
        document.getElementById(
            "editServiceName"
        );


    const priceElement =
        document.getElementById(
            "editServicePrice"
        );


    const durationElement =
        document.getElementById(
            "editServiceDuration"
        );


    const message =
        document.getElementById(
            "serviceFormMessage"
        );


    if (
        !nameElement ||
        !priceElement ||
        !durationElement ||
        !message
    ) {

        return;

    }


    const name =
        nameElement.value.trim();


    const price =
        Number(priceElement.value);


    const duration =
        Number(durationElement.value);


    if (!name) {

        message.textContent =
            "⚠️ Escribe el nombre.";

        return;

    }


    if (
        !Number.isFinite(price) ||
        price < 0
    ) {

        message.textContent =
            "⚠️ Escribe un precio válido.";

        return;

    }


    if (
        !Number.isInteger(duration) ||
        duration <= 0 ||
        duration > 480
    ) {

        message.textContent =
            "⚠️ La duración debe estar entre 1 y 480 minutos.";

        return;

    }


    message.textContent =
        "⏳ Guardando cambios...";


    const {
        data,
        error
    } =
        await client.rpc(
            "admin_update_service",
            {
                p_service_id:
                    serviceId,

                p_name:
                    name,

                p_price:
                    price,

                p_duration_minutes:
                    duration
            }
        );


    if (error) {

        console.error(
            "ERROR ACTUALIZANDO SERVICIO:",
            error
        );


        message.textContent =
            "❌ " + error.message;

        return;

    }


    if (!data) {

        message.textContent =
            "❌ No se pudo actualizar.";

        return;

    }


    await loadServices();

    renderPanel();

}


// ==========================================
// ACTIVAR / DESACTIVAR SERVICIO
// ==========================================

async function toggleService(
    serviceId,
    active
) {

    const action =
        active
            ? "activar"
            : "desactivar";


    const confirmed =
        confirm(
            `¿Quieres ${action} este servicio?`
        );


    if (!confirmed) {

        return;

    }


    const {
        data,
        error
    } =
        await client.rpc(
            "admin_toggle_service",
            {
                p_service_id:
                    serviceId,

                p_active:
                    active
            }
        );


    if (error) {

        console.error(
            "ERROR CAMBIANDO SERVICIO:",
            error
        );


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


    await loadServices();

    renderPanel();

}


// ==========================================
// LLAMAR SIGUIENTE
// ==========================================

async function callNext() {

    if (!business) {

        return;

    }


    if (currentTicket) {

        alert(
            "Primero debes finalizar el turno actual."
        );

        return;

    }


    try {

        const {
            data,
            error
        } =
            await client.rpc(
                "admin_call_next",
                {
                    p_business_id:
                        business.id
                }
            );


        if (error) {

            throw error;

        }


        currentTicket =
            data &&
            data.length > 0
                ? data[0]
                : null;


        await loadPanel();

    } catch (error) {

        console.error(
            "ERROR LLAMANDO SIGUIENTE:",
            error
        );


        alert(
            error.message
        );

    }

}


// ==========================================
// FINALIZAR TURNO
// ==========================================

async function finishCurrent() {

    if (!currentTicket) {

        return;

    }


    try {

        const {
            data,
            error
        } =
            await client.rpc(
                "admin_finish_ticket",
                {
                    p_ticket_id:
                        currentTicket.id
                }
            );


        if (error) {

            throw error;

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

    } catch (error) {

        console.error(
            "ERROR FINALIZANDO:",
            error
        );


        alert(
            error.message
        );

    }

}


// ==========================================
// NO SE PRESENTÓ
// ==========================================

async function noShowCurrent() {

    if (!currentTicket) {

        return;

    }


    try {

        const {
            data,
            error
        } =
            await client.rpc(
                "admin_no_show_ticket",
                {
                    p_ticket_id:
                        currentTicket.id
                }
            );


        if (error) {

            throw error;

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

    } catch (error) {

        console.error(
            "ERROR NO PRESENTADO:",
            error
        );


        alert(
            error.message
        );

    }

}


// ==========================================
// CERRAR SESIÓN
// ==========================================

async function logout() {

    try {

        await client.auth.signOut();

    } catch (error) {

        console.error(
            "ERROR CERRANDO SESIÓN:",
            error
        );

    }


    window.location.href =
        "login.html";

}


// ==========================================
// ACTUALIZACIÓN AUTOMÁTICA
// ==========================================

setInterval(
    async function() {

        if (!business) {

            return;

        }


        await loadPanel();

    },
    10000
);


// ==========================================
// INICIAR ADMIN
// ==========================================

async function startAdmin() {

    const hasSession =
        await checkSession();


    if (!hasSession) {

        return;

    }


    await loadBusiness();

}


startAdmin();

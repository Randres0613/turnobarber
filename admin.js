const adminApp = document.getElementById("adminApp");
const businessInfo = document.getElementById("businessInfo");
const connectionStatus = document.getElementById("connectionStatus");

let business = null;
let currentTicket = null;
let waitingTickets = [];


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

                    <label
                        for="businessName"
                    >
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

                    <label
                        for="businessCity"
                    >
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

                    <label
                        for="businessPhone"
                    >
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


        business =
            data[0];


        message.textContent =
            "✅ Barbería creada correctamente.";


        businessInfo.textContent =
            `${business.business_name} · ${business.city || ""}`;


        connectionStatus.textContent =
            "ONLINE";


        button.textContent =
            "✅ Barbería creada";


        // Pequeña pausa para que el usuario
        // vea el mensaje de confirmación.

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
// OBTENER BARBERÍA DEL USUARIO
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


        // ======================================
        // USUARIO SIN BARBERÍA
        // ======================================

        if (
            !data ||
            data.length === 0
        ) {

            showCreateBusiness();

            return;

        }


        business =
            data[0];


        // ======================================
        // VERIFICAR ROL
        // ======================================

        if (
            business.role !== "owner"
        ) {

            throw new Error(
                "Tu cuenta no tiene permisos de administrador."
            );

        }


        // ======================================
        // MOSTRAR INFORMACIÓN
        // ======================================

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
                    ${error.message}
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

        currentTicket = null;

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

        waitingTickets = [];

        return;

    }


    waitingTickets =
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
// FINALIZAR
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

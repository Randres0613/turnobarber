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

let barberQueues = [];

let barberServiceEditorOpen = false;

let barberServiceEditorBarberId = null;


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

    await loadBarberQueues();
    await loadServices();
    await loadBarbers();

    if (barberServiceEditorOpen) {
        return;
    }

    renderPanel();

}


// ==========================================
// CARGAR COLAS POR BARBERO
// ==========================================

async function loadBarberQueues() {

    const {
        data,
        error
    } =
        await client.rpc(
            "admin_barber_queues",
            {
                p_business_id:
                    business.id
            }
        );

    if (error) {

        console.error(
            "ERROR CARGANDO COLAS POR BARBERO:",
            error
        );

        barberQueues = [];
        return;

    }

    barberQueues = data || [];

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

    const totalWaiting =
        barberQueues.reduce(
            (sum, barber) =>
                sum + Number(barber.waiting_count || 0),
            0
        );

    adminApp.innerHTML = `

        ${renderBarberQueues()}

        ${renderBarbers()}

        ${renderServices()}

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
// COLAS INDEPENDIENTES POR BARBERO
// ==========================================

function renderBarberQueues() {

    return `

        <section class="card">

            <div class="queue-header">
                <h2>💈 ATENCIÓN POR BARBERO</h2>
                <span class="badge">
                    ${barberQueues.length} barberos
                </span>
            </div>

            <p style="margin-top: 0;">
                Cada barbero maneja su propia cola.
            </p>

            ${
                barberQueues.length === 0
                    ? `
                        <div class="empty">
                            <p>No hay barberos activos.</p>
                        </div>
                      `
                    : `
                        <div class="queue">
                            ${barberQueues.map(barber => `

                                <div class="queue-item" style="margin-bottom: 12px; align-items: center;">

                                    <div>
                                        <strong>
                                            💈 ${escapeHtml(barber.barber_name)}
                                        </strong>

                                        <span>
                                            ${
                                                barber.current_ticket_code
                                                    ? `🟢 Atendiendo ${escapeHtml(barber.current_ticket_code)}`
                                                    : `🟢 Disponible`
                                            }
                                        </span>

                                        <span>
                                            ${
                                                barber.next_ticket_code
                                                    ? `⏭️ Siguiente: ${escapeHtml(barber.next_ticket_code)} · ${escapeHtml(barber.next_service_name || '')}`
                                                    : `⏭️ Sin clientes esperando`
                                            }
                                        </span>

                                        <small>
                                            👥 ${Number(barber.waiting_count || 0)} esperando
                                        </small>
                                    </div>

                                    <div style="display:flex; gap:6px; flex-wrap:wrap; justify-content:flex-end;">

                                        ${
                                            barber.current_ticket_id
                                                ? `
                                                    <button
                                                        class="btn success"
                                                        onclick="finishTicket('${barber.current_ticket_id}')"
                                                    >
                                                        ✅ Finalizar ${escapeHtml(barber.current_ticket_code)}
                                                    </button>

                                                    <button
                                                        class="btn danger"
                                                        onclick="noShowTicket('${barber.current_ticket_id}')"
                                                    >
                                                        🚫 No se presentó
                                                    </button>
                                                  `
                                                : barber.next_ticket_id
                                                    ? `
                                                        <button
                                                            class="btn primary"
                                                            onclick="callNext('${barber.barber_id}')"
                                                        >
                                                            📢 Llamar ${escapeHtml(barber.next_ticket_code)}
                                                        </button>
                                                      `
                                                    : `
                                                        <span class="badge">Sin turno para llamar</span>
                                                      `
                                        }

                                    </div>

                                </div>

                            `).join('')}
                        </div>
                      `
            }

        </section>

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

                                                <button
                                                    class="btn primary"
                                                    onclick="showBarberServicesForm(
                                                        '${barber.id}'
                                                    )"
                                                >
                                                    ⚙️ Servicios
                                                </button>

                                                <button
                                                    class="btn"
                                                    onclick="createBarberInvitation(
                                                        '${barber.id}'
                                                    )"
                                                >
                                                    🔐 Dar acceso
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
// ACCESO DEL BARBERO
// ==========================================

async function createBarberInvitation(barberId) {

    if (!business || !barberId) {
        return;
    }

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

    const confirmed =
        confirm(
            `¿Generar un nuevo acceso para ${barber.name}?`
        );

    if (!confirmed) {
        return;
    }

    try {

        const {
            data,
            error
        } =
            await client.rpc(
                "create_barber_invitation",
                {
                    p_barber_id:
                        barberId
                }
            );

        if (error) {
            throw error;
        }

        if (
            !data ||
            data.length === 0 ||
            !data[0].token
        ) {
            throw new Error(
                "No se pudo generar la invitación."
            );
        }

        const token =
            data[0].token;

        const invitationUrl =
            `${window.location.origin}/barbero.html?token=${encodeURIComponent(token)}`;

        showBarberInvitationModal(
            barber,
            invitationUrl
        );

    } catch (error) {

        console.error(
            "ERROR GENERANDO ACCESO DEL BARBERO:",
            error
        );

        alert(
            "No se pudo generar el acceso: " +
            error.message
        );

    }

}


function showBarberInvitationModal(
    barber,
    invitationUrl
) {

    const existing =
        document.getElementById(
            "barberInvitationModal"
        );

    if (existing) {
        existing.remove();
    }

    const modal =
        document.createElement(
            "div"
        );

    modal.id =
        "barberInvitationModal";

    modal.style.cssText = `
        position: fixed;
        inset: 0;
        background: rgba(0,0,0,0.60);
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 20px;
        z-index: 9999;
        box-sizing: border-box;
    `;

    modal.innerHTML = `

        <div
            class="card"
            style="
                width: min(460px, 100%);
                max-height: 90vh;
                overflow-y: auto;
                text-align: center;
                position: relative;
            "
        >

            <button
                type="button"
                onclick="closeBarberInvitationModal()"
                style="
                    position:absolute;
                    top:10px;
                    right:10px;
                    border:0;
                    background:transparent;
                    font-size:22px;
                    cursor:pointer;
                "
                aria-label="Cerrar"
            >
                ✕
            </button>

            <h2 style="margin-top:5px;">
                🔐 Acceso del barbero
            </h2>

            <p>
                Acceso preparado para
                <strong>
                    ${escapeHtml(barber.name)}
                </strong>
            </p>

            <div
                id="barberInvitationQr"
                style="
                    width: 250px;
                    min-height: 250px;
                    margin: 20px auto;
                    display:flex;
                    align-items:center;
                    justify-content:center;
                    border:1px dashed rgba(127,127,127,0.4);
                    border-radius:12px;
                    background:#fff;
                "
            >
                <span>
                    ⏳ Generando QR...
                </span>
            </div>

            <p
                style="
                    font-size:13px;
                    opacity:0.75;
                    margin-bottom:15px;
                "
            >
                El QR corresponde a una invitación
                temporal y de un solo uso.
            </p>

            <input
                id="barberInvitationUrl"
                type="text"
                readonly
                value="${escapeHtml(invitationUrl)}"
                style="
                    width:100%;
                    box-sizing:border-box;
                    padding:11px;
                    border-radius:8px;
                    border:1px solid rgba(127,127,127,0.35);
                    margin-bottom:10px;
                    font-size:12px;
                "
            >

            <div
                style="
                    display:flex;
                    gap:8px;
                    flex-wrap:wrap;
                    justify-content:center;
                "
            >

                <button
                    class="btn primary"
                    onclick="copyBarberInvitationLink()"
                >
                    📋 Copiar enlace
                </button>

                <button
                    class="btn"
                    onclick="shareBarberInvitationLink()"
                >
                    📤 Compartir
                </button>

                <button
                    class="btn"
                    onclick="closeBarberInvitationModal()"
                >
                    Cerrar
                </button>

            </div>

            <p
                id="barberInvitationMessage"
                style="margin-top:12px;"
            ></p>

        </div>

    `;

    document.body.appendChild(
        modal
    );

    loadQrLibrary()
        .then(
            function() {

                const qrContainer =
                    document.getElementById(
                        "barberInvitationQr"
                    );

                if (!qrContainer) {
                    return;
                }

                qrContainer.innerHTML = "";

                new QRCode(
                    qrContainer,
                    {
                        text: invitationUrl,
                        width: 220,
                        height: 220,
                        correctLevel:
                            QRCode.CorrectLevel.M
                    }
                );

            }
        )
        .catch(
            function(error) {

                console.error(
                    "ERROR CARGANDO GENERADOR QR:",
                    error
                );

                const qrContainer =
                    document.getElementById(
                        "barberInvitationQr"
                    );

                if (qrContainer) {

                    qrContainer.innerHTML = `
                        <div style="padding:20px;">
                            <strong>
                                No se pudo cargar el QR.
                            </strong>
                            <p style="font-size:12px;">
                                Puedes utilizar el enlace
                                para compartir el acceso.
                            </p>
                        </div>
                    `;

                }

            }
        );

}


function loadQrLibrary() {

    if (
        typeof QRCode !==
        "undefined"
    ) {

        return Promise.resolve();

    }

    return new Promise(
        function(resolve, reject) {

            const existingScript =
                document.querySelector(
                    'script[data-turnobarber-qr="true"]'
                );

            if (existingScript) {

                existingScript.addEventListener(
                    "load",
                    function() {
                        resolve();
                    },
                    { once: true }
                );

                existingScript.addEventListener(
                    "error",
                    function() {
                        reject(
                            new Error(
                                "No se pudo cargar el generador QR."
                            )
                        );
                    },
                    { once: true }
                );

                return;
            }

            const script =
                document.createElement(
                    "script"
                );

            script.src =
                "https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js";

            script.async =
                true;

            script.dataset.turnobarberQr =
                "true";

            script.onload =
                function() {
                    resolve();
                };

            script.onerror =
                function() {
                    reject(
                        new Error(
                            "No se pudo cargar el generador QR."
                        )
                    );
                };

            document.head.appendChild(
                script
            );

        }
    );

}


async function copyBarberInvitationLink() {

    const input =
        document.getElementById(
            "barberInvitationUrl"
        );

    const message =
        document.getElementById(
            "barberInvitationMessage"
        );

    if (!input) {
        return;
    }

    try {

        await navigator.clipboard.writeText(
            input.value
        );

        if (message) {
            message.textContent =
                "✅ Enlace copiado.";
        }

    } catch (error) {

        input.select();

        document.execCommand(
            "copy"
        );

        if (message) {
            message.textContent =
                "✅ Enlace copiado.";
        }

    }

}


async function shareBarberInvitationLink() {

    const input =
        document.getElementById(
            "barberInvitationUrl"
        );

    const message =
        document.getElementById(
            "barberInvitationMessage"
        );

    if (!input) {
        return;
    }

    if (
        navigator.share
    ) {

        try {

            await navigator.share(
                {
                    title:
                        "Acceso TurnoBarber",
                    text:
                        "Acceso de barbero a TurnoBarber",
                    url:
                        input.value
                }
            );

            return;

        } catch (error) {

            if (
                error &&
                error.name ===
                    "AbortError"
            ) {
                return;
            }

        }

    }

    await copyBarberInvitationLink();

    if (message) {
        message.textContent =
            "📋 El enlace fue copiado para compartirlo.";
    }

}


function closeBarberInvitationModal() {

    const modal =
        document.getElementById(
            "barberInvitationModal"
        );

    if (modal) {
        modal.remove();
    }

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
// ADMINISTRAR SERVICIOS DEL BARBERO
// ==========================================

async function showBarberServicesForm(barberId) {

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


    barberServiceEditorOpen = true;

    barberServiceEditorBarberId = barberId;


    container.innerHTML = `

        <div class="card" style="border: 2px solid rgba(0, 150, 136, 0.25);">

            <div style="display:flex; justify-content:space-between; gap:12px; align-items:flex-start; flex-wrap:wrap;">

                <div>

                    <h3 style="margin-top:0;">
                        ⚙️ Servicios de ${escapeHtml(barber.name)}
                    </h3>

                    <p style="margin-bottom:0;">
                        Selecciona los servicios que este barbero puede realizar.
                    </p>

                </div>

                <span class="badge">
                    ${barber.active ? "🟢 Barbero activo" : "🔴 Barbero inactivo"}
                </span>

            </div>

            <div
                id="barberServicesEditorContent"
                style="margin-top:20px;"
            >
                <div class="empty">
                    <p>⏳ Cargando servicios...</p>
                </div>
            </div>

        </div>

    `;


    try {

        const {
            data,
            error
        } =
            await client.rpc(
                "admin_barber_services",
                {
                    p_barber_id:
                        barberId
                }
            );


        if (error) {
            throw error;
        }


        const services = data || [];

        const editor =
            document.getElementById(
                "barberServicesEditorContent"
            );


        if (!editor) {
            return;
        }


        if (services.length === 0) {

            editor.innerHTML = `

                <div class="empty">
                    <p>
                        No tienes servicios creados todavía.
                    </p>
                    <p>
                        Primero crea servicios en <strong>Mis servicios</strong>.
                    </p>
                    <button
                        class="btn"
                        onclick="closeBarberServicesForm()"
                        style="margin-top:8px;"
                    >
                        ← Volver
                    </button>
                </div>

            `;

            return;
        }


        editor.innerHTML = `

            <div style="display:flex; flex-direction:column; gap:10px;">

                ${services.map(service => `

                    <label
                        style="
                            display:flex;
                            align-items:center;
                            justify-content:space-between;
                            gap:12px;
                            padding:14px;
                            border:1px solid rgba(127,127,127,0.25);
                            border-radius:12px;
                            cursor:${service.active ? "pointer" : "default"};
                            opacity:${service.active ? "1" : "0.65"};
                        "
                    >

                        <span style="display:flex; align-items:center; gap:12px; min-width:0;">

                            <input
                                type="checkbox"
                                data-barber-service-id="${service.id}"
                                ${service.assigned ? "checked" : ""}
                                ${service.active ? "" : "disabled"}
                                style="width:20px; height:20px; flex:0 0 auto;"
                            >

                            <span style="min-width:0;">

                                <strong style="display:block;">
                                    ${escapeHtml(service.name)}
                                </strong>

                                <small>
                                    $${Number(service.price || 0).toLocaleString("es-CO")} · ${Number(service.duration_minutes || 0)} min
                                </small>

                            </span>

                        </span>

                        <span class="badge">
                            ${service.active ? (service.assigned ? "Asignado" : "No asignado") : "Servicio inactivo"}
                        </span>

                    </label>

                `).join("")}

            </div>

            <p
                id="barberServicesFormMessage"
                style="margin:15px 0 0;"
            ></p>

            <div
                style="
                    display:flex;
                    gap:8px;
                    flex-wrap:wrap;
                    margin-top:15px;
                "
            >

                <button
                    class="btn primary"
                    onclick="saveBarberServices('${barberId}')"
                >
                    💾 Guardar cambios
                </button>

                <button
                    class="btn"
                    onclick="closeBarberServicesForm()"
                >
                    Cancelar
                </button>

            </div>

        `;

    } catch (error) {

        console.error(
            "ERROR CARGANDO SERVICIOS DEL BARBERO:",
            error
        );

        const editor =
            document.getElementById(
                "barberServicesEditorContent"
            );

        if (editor) {

            editor.innerHTML = `

                <div class="empty">
                    <p>❌ ${escapeHtml(error.message)}</p>
                    <button
                        class="btn"
                        onclick="closeBarberServicesForm()"
                        style="margin-top:8px;"
                    >
                        ← Volver
                    </button>
                </div>

            `;

        }

    }

}


// ==========================================
// GUARDAR SERVICIOS DEL BARBERO
// ==========================================

async function saveBarberServices(barberId) {

    if (
        !barberServiceEditorOpen ||
        barberServiceEditorBarberId !== barberId
    ) {
        return;
    }


    const message =
        document.getElementById(
            "barberServicesFormMessage"
        );


    const checkboxes =
        Array.from(
            document.querySelectorAll(
                "input[data-barber-service-id]"
            )
        );


    if (!checkboxes.length) {

        if (message) {
            message.textContent =
                "⚠️ No hay servicios para guardar.";
        }

        return;
    }


    const buttons =
        document.querySelectorAll(
            "#barberServicesEditorContent button"
        );


    buttons.forEach(
        button => button.disabled = true
    );


    if (message) {
        message.textContent =
            "⏳ Guardando servicios...";
    }


    try {

        const results =
            await Promise.all(
                checkboxes.map(checkbox =>
                    client.rpc(
                        "admin_set_barber_service",
                        {
                            p_barber_id:
                                barberId,

                            p_service_id:
                                checkbox.dataset.barberServiceId,

                            p_assigned:
                                checkbox.checked
                        }
                    )
                )
            );


        const failed =
            results.find(
                result => result.error || result.data !== true
            );


        if (failed) {

            throw (
                failed.error ||
                new Error(
                    "No se pudo guardar uno de los servicios."
                )
            );

        }


        barberServiceEditorOpen = false;
        barberServiceEditorBarberId = null;

        await loadPanel();

    } catch (error) {

        console.error(
            "ERROR GUARDANDO SERVICIOS DEL BARBERO:",
            error
        );

        if (message) {
            message.textContent =
                "❌ " + error.message;
        }

        buttons.forEach(
            button => button.disabled = false
        );

    }

}


// ==========================================
// CERRAR SERVICIOS DEL BARBERO
// ==========================================

function closeBarberServicesForm() {

    barberServiceEditorOpen = false;
    barberServiceEditorBarberId = null;

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
// LLAMAR SIGUIENTE DE UN BARBERO
// ==========================================

async function callNext(barberId) {

    if (!business || !barberId) {
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
                        business.id,
                    p_barber_id:
                        barberId
                }
            );

        if (error) {
            throw error;
        }

        if (!data || data.length === 0) {
            alert("No se pudo llamar el siguiente turno.");
            return;
        }

        await loadPanel();

    } catch (error) {

        console.error(
            "ERROR LLAMANDO SIGUIENTE:",
            error
        );

        alert(error.message);

    }

}


// ==========================================
// FINALIZAR TURNO POR ID
// ==========================================

async function finishTicket(ticketId) {

    if (!ticketId) {
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
                        ticketId
                }
            );

        if (error) {
            throw error;
        }

        if (!data) {
            alert("No se pudo finalizar el turno.");
            return;
        }

        await loadPanel();

    } catch (error) {

        console.error(
            "ERROR FINALIZANDO TURNO:",
            error
        );

        alert(error.message);

    }

}


// ==========================================
// NO SE PRESENTÓ POR ID
// ==========================================

async function noShowTicket(ticketId) {

    if (!ticketId) {
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
                        ticketId
                }
            );

        if (error) {
            throw error;
        }

        if (!data) {
            alert("No se pudo cambiar el estado del turno.");
            return;
        }

        await loadPanel();

    } catch (error) {

        console.error(
            "ERROR NO PRESENTADO:",
            error
        );

        alert(error.message);

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


        if (barberServiceEditorOpen) {

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

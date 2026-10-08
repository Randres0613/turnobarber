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

// URL pública oficial de TurnoBarber.
// Los enlaces para clientes y barberos deben apuntar siempre
// a la versión pública, incluso cuando el administrador trabaje localmente.
const TURNOBARBER_PUBLIC_BASE_URL =
    "https://turnobarber360.com/";
let activeAdminTab = "home";
let adminMoreView = "menu";
let adminSettingsOpen = false;
let adminSettingsView = "menu";
let businessEditSaving = false;
let businessEditMessage = "";
let businessEditMessageType = "";
let subscriptionContext = null;
let subscriptionLoading = false;
let subscriptionCheckoutLoading = false;
let subscriptionCheckoutMessage = "";
let inPersonService = null;
let inPersonBarbers = [];
let inPersonBarber = null;
let inPersonTicket = null;
let inPersonLoadingBarbers = false;
let inPersonCreatingTicket = false;
let inPersonError = "";

// ==========================================
// ESTADÍSTICAS E INDICADORES
// ==========================================
let statisticsData = null;
let statisticsLoading = false;
let statisticsError = "";
let statisticsPreset = "7d";
let statisticsCustomStart = "";
let statisticsCustomEnd = "";
let financialEntriesData = [];
let financialLoading = false;
let financialError = "";

// Control de capacidades por plan.
// El backend de Supabase es la fuente de verdad; la UI solo refleja
// las capacidades autorizadas para la barbería y su estado de suscripción.
let featureAccess = {};
let featureAccessLoading = false;
let featureAccessError = "";
let featureAccessKey = "";

const TURNOBARBER_FEATURES = [
    "basic_indicators",
    "basic_reports_csv",
    "advanced_indicators",
    "financial_management",
    "period_comparison",
    "history",
    "reports_pdf",
    "reports_excel",
    "reports_csv",
    "multi_location",
    "consolidated_reports",
    "advanced_business_indicators"
];

let adminDateTimeTimer = null;

function getAdminDateTimeElement() {
    return document.getElementById("adminDateTime");
}

function renderAdminDateTime() {
    const element = getAdminDateTimeElement();

    if (!element) {
        return;
    }

    const timezone = business?.timezone || "America/Bogota";

    try {
        const now = new Date();
        const dateFormatter = new Intl.DateTimeFormat("es-CO", {
            timeZone: timezone,
            day: "2-digit",
            month: "2-digit",
            year: "numeric"
        });
        const timeFormatter = new Intl.DateTimeFormat("es-CO", {
            timeZone: timezone,
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
            hour12: false
        });

        element.textContent = `${dateFormatter.format(now)} · ${timeFormatter.format(now)}`;
    } catch (error) {
        console.error("ERROR MOSTRANDO FECHA Y HORA:", error);
        element.textContent = "Fecha y hora no disponible";
    }
}

function startAdminDateTime() {
    if (adminDateTimeTimer) {
        clearInterval(adminDateTimeTimer);
        adminDateTimeTimer = null;
    }

    const element = getAdminDateTimeElement();

    if (!element) {
        return;
    }

    element.textContent = "Cargando fecha y hora…";
    renderAdminDateTime();

    adminDateTimeTimer = setInterval(
        renderAdminDateTime,
        1000
    );
}

function formatMoney(value) {
    return "$" + Number(value || 0).toLocaleString("es-CO");
}

// Estado visual de los acordeones principales.
// Se conserva durante las actualizaciones automáticas del panel.
let adminPublicQrOpen = false;
let adminBarbersSectionOpen = false;
let adminServicesSectionOpen = false;

// Acordeones internos de cada barbero/servicio.
const openAdminAccordions = new Set();

function getAdminUiStateKey() {
    return business?.id ? `turnoBarberAdminUiState:${business.id}` : null;
}

function loadAdminUiState() {
    const key = getAdminUiStateKey();
    if (!key) return;

    try {
        const saved = JSON.parse(localStorage.getItem(key) || "null");
        if (!saved || typeof saved !== "object") return;

        adminPublicQrOpen = saved.publicQrOpen === true;
        adminBarbersSectionOpen = saved.barbersSectionOpen === true;
        adminServicesSectionOpen = saved.servicesSectionOpen === true;

        if (typeof saved.activeAdminTab === "string" && ["home", "tickets", "new", "barbers", "indicators"].includes(saved.activeAdminTab)) {
            activeAdminTab = saved.activeAdminTab;
        }

        adminSettingsOpen = saved.settingsOpen === true;
        if (typeof saved.settingsView === "string" && ["menu", "business", "services", "barbers", "qr", "tv"].includes(saved.settingsView)) {
            adminSettingsView = saved.settingsView;
        } else {
            adminSettingsView = "menu";
        }

        if (["today", "7d", "30d", "custom"].includes(saved.statisticsPreset)) {
            statisticsPreset = saved.statisticsPreset;
        }
        statisticsCustomStart = typeof saved.statisticsCustomStart === "string" ? saved.statisticsCustomStart : "";
        statisticsCustomEnd = typeof saved.statisticsCustomEnd === "string" ? saved.statisticsCustomEnd : "";

        openAdminAccordions.clear();
        if (Array.isArray(saved.openAccordions)) {
            saved.openAccordions.forEach(id => {
                if (typeof id === "string") openAdminAccordions.add(id);
            });
        }
    } catch (error) {
        console.warn("No se pudo restaurar el estado visual del panel:", error);
    }
}

function saveAdminUiState() {
    const key = getAdminUiStateKey();
    if (!key) return;

    try {
        localStorage.setItem(key, JSON.stringify({
            publicQrOpen: adminPublicQrOpen,
            barbersSectionOpen: adminBarbersSectionOpen,
            servicesSectionOpen: adminServicesSectionOpen,
            activeAdminTab,
            settingsOpen: adminSettingsOpen,
            settingsView: adminSettingsView,
            statisticsPreset,
            statisticsCustomStart,
            statisticsCustomEnd,
            openAccordions: Array.from(openAdminAccordions)
        }));
    } catch (error) {
        console.warn("No se pudo guardar el estado visual del panel:", error);
    }
}


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

    const settingsButton = document.getElementById("adminSettingsButton");
    if (settingsButton) settingsButton.style.display = "none";

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
                TurnoBarber 360.
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

        loadAdminUiState();


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

        startAdminDateTime();


        connectionStatus.textContent =
            "ONLINE";

        const settingsButton = document.getElementById("adminSettingsButton");
        if (settingsButton) settingsButton.style.display = "inline-flex";

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
// CONTROL DE CAPACIDADES POR PLAN
// ==========================================

function getFeatureAccessKey() {
    const businessId = business?.id || "";
    const plan = String(subscriptionContext?.plan || business?.plan || "").toUpperCase();
    const status = String(subscriptionContext?.subscription_status || business?.subscription_status || "").toUpperCase();
    return `${businessId}|${plan}|${status}`;
}

async function loadFeatureAccess() {
    if (!business?.id) {
        featureAccess = {};
        featureAccessKey = "";
        featureAccessError = "";
        return;
    }

    const key = getFeatureAccessKey();
    if (featureAccessKey === key && Object.keys(featureAccess).length === TURNOBARBER_FEATURES.length) {
        return;
    }

    if (featureAccessLoading) return;

    featureAccessLoading = true;
    featureAccessError = "";

    try {
        const results = await Promise.all(
            TURNOBARBER_FEATURES.map(async feature => {
                const { data, error } = await client.rpc("business_has_feature", {
                    p_business_id: business.id,
                    p_feature: feature
                });

                if (error) throw error;
                return [feature, data === true];
            })
        );

        featureAccess = Object.fromEntries(results);
        featureAccessKey = key;
    } catch (error) {
        console.error("ERROR VERIFICANDO CAPACIDADES DEL PLAN:", error);
        featureAccess = {};
        featureAccessKey = "";
        featureAccessError = error?.message || "No fue posible verificar las capacidades de la suscripción.";
    } finally {
        featureAccessLoading = false;
    }
}

function hasFeature(feature) {
    return featureAccess[feature] === true;
}

function getFeatureRequiredPlan(feature) {
    return [
        "multi_location",
        "consolidated_reports",
        "advanced_business_indicators"
    ].includes(feature) ? "BUSINESS" : "PRO";
}

function renderLockedFeatureCard(title, feature, description) {
    if (featureAccessLoading) {
        return `<section class="card"><p class="muted" style="margin:0;">Verificando las capacidades de tu plan…</p></section>`;
    }

    if (featureAccessError) {
        return `<section class="card"><h2>🔐 ${escapeHtml(title)}</h2><p class="muted">No fue posible verificar los permisos de esta función.</p><p class="muted" style="font-size:13px;">${escapeHtml(featureAccessError)}</p><button type="button" class="btn primary" onclick="loadFeatureAccess().then(() => renderPanel())">🔄 Verificar nuevamente</button></section>`;
    }

    const requiredPlan = getFeatureRequiredPlan(feature);
    return `<section class="card"><h2>🔒 ${escapeHtml(title)}</h2><p class="muted">${escapeHtml(description)}</p><p style="margin:12px 0 0;"><strong>Disponible desde el plan ${requiredPlan}.</strong></p></section>`;
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
    await loadSubscriptionContext();
    await loadFeatureAccess();

    if (barberServiceEditorOpen) {
        return;
    }

    renderPanel();

    if (activeAdminTab === "indicators") {
        loadStatisticsIndicators();
        loadFinancialEntries();
    }

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
// SUSCRIPCIÓN
// ==========================================

async function loadSubscriptionContext() {
    if (!business?.id) {
        subscriptionContext = null;
        return;
    }

    subscriptionLoading = true;

    try {
        const { data, error } = await client.rpc("get_subscription_context", {
            p_business_id: business.id
        });

        if (error) throw error;

        subscriptionContext = Array.isArray(data) ? (data[0] || null) : (data || null);
    } catch (error) {
        console.error("ERROR CARGANDO SUSCRIPCIÓN:", error);
        subscriptionContext = null;
    } finally {
        subscriptionLoading = false;
    }
}

function formatSubscriptionStatus(status) {
    const labels = {
        TRIAL: "Prueba gratuita",
        TRIAL_EXPIRED: "Prueba vencida",
        ACTIVE: "Activa",
        PAST_DUE: "Pago pendiente",
        SUSPENDED: "Suspendida"
    };
    return labels[String(status || "").toUpperCase()] || String(status || "Sin información");
}

function formatSubscriptionDate(value) {
    if (!value) return "—";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "—";
    return date.toLocaleString("es-CO", { dateStyle: "medium", timeStyle: "short" });
}

function subscriptionStatusBadgeClass(status) {
    const normalized = String(status || "").toUpperCase();
    if (normalized === "ACTIVE") return "";
    if (normalized === "PAST_DUE") return "warn";
    if (normalized === "TRIAL_EXPIRED" || normalized === "SUSPENDED") return "danger";
    return "muted";
}

function getSubscriptionPlanName(plan) {
    const names = { START: "START", PRO: "PRO", BUSINESS: "BUSINESS" };
    return names[String(plan || "").toUpperCase()] || String(plan || "—");
}

function renderSubscriptionCard() {
    if (subscriptionLoading) {
        return `
            <section class="card">
                <div class="queue-header">
                    <div><p class="muted" style="margin:0;">Suscripción</p><h2>💳 Plan de TurnoBarber 360</h2></div>
                    <span class="badge muted">CARGANDO</span>
                </div>
                <p class="muted">Consultando el estado actual de tu suscripción…</p>
            </section>
        `;
    }

    if (!subscriptionContext) {
        return `
            <section class="card">
                <div class="queue-header">
                    <div><p class="muted" style="margin:0;">Suscripción</p><h2>💳 Plan de TurnoBarber 360</h2></div>
                    <span class="badge warn">NO DISPONIBLE</span>
                </div>
                <p class="muted">No fue posible consultar el estado de la suscripción. Intenta nuevamente.</p>
                <button type="button" class="btn secondary" onclick="loadSubscriptionContext().then(() => refreshAdminSettingsContent({ resetScroll: false }))">🔄 Actualizar</button>
            </section>
        `;
    }

    const status = String(subscriptionContext.subscription_status || "").toUpperCase();
    const plan = getSubscriptionPlanName(subscriptionContext.plan);
    const activeBarbers = Number(subscriptionContext.active_barbers || 0);
    const maxBarbers = Number(subscriptionContext.max_active_barbers || 0);
    const periodDate = status === "TRIAL" ? subscriptionContext.trial_ends_at : subscriptionContext.current_period_end;
    const periodLabel = status === "TRIAL" ? "La prueba termina" : "Próximo vencimiento";
    const canOperate = Boolean(subscriptionContext.can_operate);

    return `
        <section class="card">
            <div class="queue-header">
                <div><p class="muted" style="margin:0;">Suscripción</p><h2>💳 Plan ${escapeHtml(plan)}</h2></div>
                <span class="badge ${subscriptionStatusBadgeClass(status)}">${escapeHtml(formatSubscriptionStatus(status))}</span>
            </div>
            <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px;margin-top:16px;">
                <div class="status-box"><strong>Barberos</strong><div>${activeBarbers} / ${maxBarbers}</div></div>
                <div class="status-box"><strong>Facturación</strong><div>${escapeHtml(String(subscriptionContext.billing_cycle || "—").toUpperCase())}</div></div>
                <div class="status-box"><strong>Operación</strong><div>${canOperate ? "Disponible" : "Restringida"}</div></div>
            </div>
            ${periodDate ? `<p style="margin-top:16px;"><strong>${periodLabel}:</strong> ${escapeHtml(formatSubscriptionDate(periodDate))}</p>` : ""}
            ${status === "PAST_DUE" ? `<p class="tool-note">Tu suscripción tiene un pago pendiente. Puedes regularizarla desde el proceso de pago.</p>` : ""}
            ${status === "TRIAL_EXPIRED" || status === "SUSPENDED" ? `<p class="tool-note">El servicio requiere una suscripción activa para continuar operando.</p>` : ""}
            ${subscriptionCheckoutMessage ? `<p class="tool-note" style="margin-top:12px;">${escapeHtml(subscriptionCheckoutMessage)}</p>` : ""}
            <div class="admin-actions" style="margin-top:16px;">
                <button type="button" class="btn primary" onclick="showSubscriptionPlans()" ${subscriptionCheckoutLoading ? "disabled" : ""}>💳 ${status === "TRIAL" ? "Elegir un plan" : "Gestionar suscripción"}</button>
            </div>
        </section>
    `;
}

async function showSubscriptionPlans() {
    if (subscriptionCheckoutLoading) return;

    const modalContent = createAdminModal(
        "Planes y suscripción",
        '<p class="muted" role="status">Cargando planes y precios…</p>'
    );

    try {
        const { data, error } = await client
            .from("subscription_plans")
            .select("code,name,monthly_price_cop,yearly_price_cop,max_active_barbers,max_locations")
            .order("monthly_price_cop", { ascending: true });

        if (error) throw error;

        const plans = (Array.isArray(data) ? data : []).filter(plan =>
            /^[A-Z0-9_-]{1,32}$/.test(String(plan?.code || "").toUpperCase())
        );

        if (!plans.length) {
            throw new Error("No hay planes disponibles en este momento.");
        }

        if (!modalContent.isConnected) return;

        const currentPlan = String(subscriptionContext?.plan || "").toUpperCase();
        const currentCycle = String(subscriptionContext?.billing_cycle || "").toLowerCase();
        modalContent.innerHTML = `
            <p class="muted" style="margin-top:0;">Selecciona el plan y la modalidad de facturación. El pago se procesa de forma segura con Wompi.</p>
            <div class="subscription-plan-grid" style="display:grid;gap:12px;">
                ${plans.map(plan => {
                    const code = String(plan.code).toUpperCase();
                    const name = plan.name || code;
                    const locations = Number(plan.max_locations || 0);
                    return `
                        <article class="card" style="margin:0;border:1px solid rgba(127,127,127,.25);">
                            <div class="queue-header">
                                <div><h3 style="margin:0;">${escapeHtml(name)}</h3><p class="muted" style="margin:4px 0 0;">Hasta ${Number(plan.max_active_barbers || 0)} barberos activos · ${locations} ${locations === 1 ? "ubicación" : "ubicaciones"}</p></div>
                                ${currentPlan === code ? `<span class="badge">PLAN ACTUAL</span>` : ""}
                            </div>
                            <div class="subscription-plan-prices" style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:12px;">
                                <button type="button" class="btn ${currentPlan === code && currentCycle === "monthly" ? "primary" : "secondary"}" onclick="startSubscriptionCheckout('${code}', 'monthly')">Mensual<br><strong>${formatMoney(plan.monthly_price_cop)}</strong></button>
                                <button type="button" class="btn ${currentPlan === code && currentCycle === "yearly" ? "primary" : "secondary"}" onclick="startSubscriptionCheckout('${code}', 'yearly')">Anual<br><strong>${formatMoney(plan.yearly_price_cop)}</strong></button>
                            </div>
                        </article>
                    `;
                }).join("")}
            </div>
            <p class="muted" style="font-size:12px;margin-bottom:0;">Los planes y límites se validan también en el backend.</p>
        `;
    } catch (error) {
        console.error("ERROR CARGANDO PLANES DE SUSCRIPCIÓN:", error);
        if (modalContent.isConnected) {
            modalContent.textContent = error?.message || "No fue posible cargar los planes. Intenta nuevamente.";
        }
    }
}

async function startSubscriptionCheckout(plan, billingCycle) {
    if (subscriptionCheckoutLoading) return;

    subscriptionCheckoutLoading = true;
    subscriptionCheckoutMessage = "";

    const normalizedPlan = String(plan || "").trim().toUpperCase();
    const normalizedCycle = String(billingCycle || "").trim().toLowerCase();

    try {
        const { data, error } = await client.functions.invoke("subscription-checkout", {
            body: { plan: normalizedPlan, billing_cycle: normalizedCycle }
        });

        if (error) throw error;
        if (!data?.wompi?.checkout_url) throw new Error("No se recibió el enlace de pago de Wompi.");

        closeAdminModal();
        window.location.href = data.wompi.checkout_url;
    } catch (error) {
        console.error("ERROR INICIANDO CHECKOUT DE SUSCRIPCIÓN:", error);
        subscriptionCheckoutMessage = error?.message || "No fue posible iniciar el pago.";
        subscriptionCheckoutLoading = false;

        const modalContent = document.getElementById("adminActionModalContent");
        if (modalContent) {
            const existingError = document.getElementById("subscriptionCheckoutError");
            if (existingError) {
                existingError.remove();
            }

            const errorElement = document.createElement("div");
            errorElement.id = "subscriptionCheckoutError";
            errorElement.className = "tool-note";
            errorElement.style.cssText = "margin-top:14px;border:1px solid rgba(180,0,0,.25);padding:12px;border-radius:10px;";
            errorElement.innerHTML = `<strong>No se pudo iniciar el pago.</strong><br>${escapeHtml(subscriptionCheckoutMessage)}`;
            modalContent.appendChild(errorElement);
        } else {
            refreshAdminSettingsContent({ resetScroll: false });
        }
    }
}

// ==========================================
// ESTADÍSTICAS E INDICADORES
// ==========================================

function getStatisticsTodayString() {
    const timezone = business?.timezone || "America/Bogota";
    try {
        return new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
    } catch (error) {
        console.warn("No se pudo obtener la fecha local de estadísticas:", error);
        return new Date().toISOString().slice(0, 10);
    }
}

function shiftStatisticsDate(dateString, days) {
    const [year, month, day] = String(dateString || "").split("-").map(Number);
    if (!year || !month || !day) return dateString;
    const date = new Date(Date.UTC(year, month - 1, day));
    date.setUTCDate(date.getUTCDate() + days);
    return date.toISOString().slice(0, 10);
}

function getStatisticsDateRange() {
    const today = getStatisticsTodayString();
    if (statisticsPreset === "today") return { start: today, end: today };
    if (statisticsPreset === "30d") return { start: shiftStatisticsDate(today, -29), end: today };
    if (statisticsPreset === "custom") {
        const start = statisticsCustomStart || shiftStatisticsDate(today, -6);
        const end = statisticsCustomEnd || today;
        return start <= end ? { start, end } : { start: end, end: start };
    }
    return { start: shiftStatisticsDate(today, -6), end: today };
}

function formatStatisticsMinutes(value) {
    const minutes = Number(value || 0);
    if (!Number.isFinite(minutes) || minutes <= 0) return "0 min";
    if (minutes < 60) return `${Math.round(minutes)} min`;
    const hours = Math.floor(minutes / 60);
    const remaining = Math.round(minutes % 60);
    return remaining > 0 ? `${hours} h ${remaining} min` : `${hours} h`;
}

function formatStatisticsPercentage(value) {
    const number = Number(value);
    if (!Number.isFinite(number)) return "Sin comparación";
    const sign = number > 0 ? "+" : "";
    return `${sign}${number.toLocaleString("es-CO", { maximumFractionDigits: 2 })}%`;
}

function statisticsComparisonClass(value) {
    const number = Number(value);
    if (!Number.isFinite(number) || number === 0) return "muted";
    return number > 0 ? "positive" : "negative";
}

async function loadStatisticsIndicators() {
    if (!business?.id || statisticsLoading) return;
    if (!hasFeature("advanced_indicators")) {
        statisticsData = null;
        refreshStatisticsIndicatorsView();
        return;
    }
    const range = getStatisticsDateRange();
    statisticsLoading = true;
    statisticsError = "";
    try {
        const { data, error } = await client.rpc("admin_statistics_indicators", {
            p_business_id: business.id,
            p_start_date: range.start,
            p_end_date: range.end
        });
        if (error) throw error;
        statisticsData = data || null;
    } catch (error) {
        console.error("ERROR CARGANDO ESTADÍSTICAS:", error);
        statisticsError = error?.message || "No fue posible cargar las estadísticas.";
    } finally {
        statisticsLoading = false;
        if (activeAdminTab === "indicators") refreshStatisticsIndicatorsView();
    }
}

function refreshStatisticsIndicatorsView() {
    const container = document.getElementById("statisticsIndicatorsContainer");
    if (container) container.innerHTML = renderStatisticsIndicatorsContent();
}

function setStatisticsPreset(preset) {
    if (!hasFeature("advanced_indicators")) return;
    statisticsPreset = ["today", "7d", "30d", "custom"].includes(preset) ? preset : "7d";
    saveAdminUiState();
    renderPanel();
    if (statisticsPreset !== "custom") {
        loadStatisticsIndicators();
        loadFinancialEntries();
    }
}

function setStatisticsCustomDate(type, value) {
    if (!hasFeature("advanced_indicators")) return;
    if (type === "start") statisticsCustomStart = value || "";
    if (type === "end") statisticsCustomEnd = value || "";
    saveAdminUiState();
    if (statisticsCustomStart && statisticsCustomEnd) {
        loadStatisticsIndicators();
        loadFinancialEntries();
    }
}

function canUseFinancialModule() {
    return hasFeature("financial_management");
}

function getFinancialEntryTypeLabel(type) {
    return type === "expense" ? "Gasto" : "Ingreso";
}

function getFinancialEntryCategories(type) {
    if (type === "expense") {
        return [
            "Arriendo",
            "Servicios públicos",
            "Nómina",
            "Insumos",
            "Productos",
            "Comisiones",
            "Publicidad",
            "Mantenimiento",
            "Otros gastos"
        ];
    }

    return [
        "Ingreso adicional",
        "Venta de producto",
        "Otro ingreso"
    ];
}

function loadFinancialEntries() {
    if (!business?.id || financialLoading || !canUseFinancialModule()) return;

    const range = getStatisticsDateRange();
    financialLoading = true;
    financialError = "";
    refreshFinancialEntriesView();

    client.rpc("admin_financial_entries", {
        p_business_id: business.id,
        p_start_date: range.start,
        p_end_date: range.end
    }).then(({ data, error }) => {
        if (error) {
            console.error("ERROR CARGANDO REGISTRO FINANCIERO:", error);
            financialEntriesData = [];
            financialError = error.message || "No fue posible cargar el registro financiero.";
        } else {
            financialEntriesData = Array.isArray(data?.entries) ? data.entries : [];
        }
    }).catch(error => {
        console.error("ERROR CARGANDO REGISTRO FINANCIERO:", error);
        financialEntriesData = [];
        financialError = error?.message || "No fue posible cargar el registro financiero.";
    }).finally(() => {
        financialLoading = false;
        if (activeAdminTab === "indicators") refreshFinancialEntriesView();
    });
}

function refreshFinancialEntriesView() {
    const container = document.getElementById("financialEntriesContainer");
    if (container) container.innerHTML = renderFinancialEntriesContent();
}

function openFinancialEntryForm(entryId = null) {
    if (!canUseFinancialModule()) {
        createAdminModal("Registro financiero", `<p class="muted">Esta función está disponible en los planes PRO y BUSINESS.</p>`);
        return;
    }

    const entry = entryId ? financialEntriesData.find(item => item.id === entryId) : null;
    const type = entry?.entry_type || "expense";
    const categories = getFinancialEntryCategories(type);
    const selectedCategory = entry?.category || categories[0];
    const range = getStatisticsDateRange();
    const defaultDate = entry?.entry_date || range.end;

    const content = `
        <form id="financialEntryForm" onsubmit="saveFinancialEntry(event, '${entry?.id || ""}')">
            <div style="display:grid;gap:12px;">
                <label>Fecha
                    <input id="financialEntryDate" type="date" value="${escapeHtml(defaultDate)}" required style="width:100%;box-sizing:border-box;margin-top:6px;">
                </label>
                <label>Tipo
                    <select id="financialEntryType" onchange="refreshFinancialEntryCategories()" style="width:100%;box-sizing:border-box;margin-top:6px;">
                        <option value="expense" ${type === "expense" ? "selected" : ""}>Gasto</option>
                        <option value="income" ${type === "income" ? "selected" : ""}>Ingreso adicional</option>
                    </select>
                </label>
                <label>Categoría
                    <select id="financialEntryCategory" style="width:100%;box-sizing:border-box;margin-top:6px;">
                        ${categories.map(category => `<option value="${escapeHtml(category)}" ${category === selectedCategory ? "selected" : ""}>${escapeHtml(category)}</option>`).join("")}
                    </select>
                </label>
                <label>Valor
                    <input id="financialEntryAmount" type="number" min="1" step="0.01" value="${entry ? escapeHtml(entry.amount) : ""}" placeholder="Ej. 150000" required style="width:100%;box-sizing:border-box;margin-top:6px;">
                </label>
                <label>Descripción <span class="muted">(opcional)</span>
                    <input id="financialEntryDescription" type="text" maxlength="200" value="${escapeHtml(entry?.description || "")}" placeholder="Ej. Arriendo del local" style="width:100%;box-sizing:border-box;margin-top:6px;">
                </label>
                <label>Medio de pago <span class="muted">(opcional)</span>
                    <select id="financialEntryPaymentMethod" style="width:100%;box-sizing:border-box;margin-top:6px;">
                        <option value="">No especificado</option>
                        ${["Efectivo", "Transferencia", "Tarjeta", "Nequi", "Daviplata", "Otro"].map(method => `<option value="${escapeHtml(method)}" ${method === (entry?.payment_method || "") ? "selected" : ""}>${escapeHtml(method)}</option>`).join("")}
                    </select>
                </label>
                <button class="btn primary" type="submit">${entry ? "Guardar cambios" : "Registrar movimiento"}</button>
            </div>
        </form>
    `;

    createAdminModal(entry ? "Editar movimiento financiero" : "Nuevo movimiento financiero", content);
}

function refreshFinancialEntryCategories() {
    const typeElement = document.getElementById("financialEntryType");
    const categoryElement = document.getElementById("financialEntryCategory");
    if (!typeElement || !categoryElement) return;

    const categories = getFinancialEntryCategories(typeElement.value);
    categoryElement.innerHTML = categories.map(category => `<option value="${escapeHtml(category)}">${escapeHtml(category)}</option>`).join("");
}

async function saveFinancialEntry(event, entryId = "") {
    event.preventDefault();

    const date = document.getElementById("financialEntryDate")?.value || "";
    const type = document.getElementById("financialEntryType")?.value || "";
    const category = document.getElementById("financialEntryCategory")?.value || "";
    const amount = Number(document.getElementById("financialEntryAmount")?.value || 0);
    const description = document.getElementById("financialEntryDescription")?.value || "";
    const paymentMethod = document.getElementById("financialEntryPaymentMethod")?.value || "";

    if (!date || !type || !category || !Number.isFinite(amount) || amount <= 0) {
        alert("Completa la fecha, el tipo, la categoría y un valor mayor que cero.");
        return;
    }

    const submitButton = event.target.querySelector("button[type='submit']");
    if (submitButton) submitButton.disabled = true;

    try {
        const rpcName = entryId ? "admin_update_financial_entry" : "admin_add_financial_entry";
        const params = entryId ? {
            p_entry_id: entryId,
            p_entry_date: date,
            p_entry_type: type,
            p_category: category,
            p_amount: amount,
            p_description: description,
            p_payment_method: paymentMethod
        } : {
            p_business_id: business.id,
            p_entry_date: date,
            p_entry_type: type,
            p_category: category,
            p_amount: amount,
            p_description: description,
            p_payment_method: paymentMethod
        };

        const { error } = await client.rpc(rpcName, params);
        if (error) throw error;

        closeAdminModal();
        loadFinancialEntries();
    } catch (error) {
        console.error("ERROR GUARDANDO REGISTRO FINANCIERO:", error);
        alert(error?.message || "No fue posible guardar el movimiento.");
        if (submitButton) submitButton.disabled = false;
    }
}

async function deleteFinancialEntry(entryId) {
    if (!entryId || !canUseFinancialModule()) return;
    if (!confirm("¿Quieres eliminar este movimiento financiero? Esta acción no se puede deshacer.")) return;

    try {
        const { error } = await client.rpc("admin_delete_financial_entry", {
            p_entry_id: entryId
        });
        if (error) throw error;
        loadFinancialEntries();
    } catch (error) {
        console.error("ERROR ELIMINANDO REGISTRO FINANCIERO:", error);
        alert(error?.message || "No fue posible eliminar el movimiento.");
    }
}


function getStatisticsReportSnapshot() {
    const range = getStatisticsDateRange();
    const summary = statisticsData?.summary || {};
    const comparison = statisticsData?.comparison || {};
    const services = Array.isArray(statisticsData?.services) ? statisticsData.services : [];
    const barbers = Array.isArray(statisticsData?.barbers) ? statisticsData.barbers : [];
    const daily = Array.isArray(statisticsData?.daily) ? statisticsData.daily : [];
    const entries = Array.isArray(financialEntriesData) ? financialEntriesData : [];

    const manualIncome = entries
        .filter(item => item.entry_type === "income")
        .reduce((sum, item) => sum + Number(item.amount || 0), 0);
    const expenses = entries
        .filter(item => item.entry_type === "expense")
        .reduce((sum, item) => sum + Number(item.amount || 0), 0);

    return {
        range,
        summary,
        comparison,
        services,
        barbers,
        daily,
        entries,
        manualIncome,
        expenses,
        manualResult: manualIncome - expenses,
        estimatedPeriodIncome: Number(summary.estimated_revenue || 0) + manualIncome - expenses
    };
}

function csvEscape(value) {
    const text = value === null || value === undefined ? "" : String(value);
    return `"${text.replace(/"/g, '""')}"`;
}

function downloadBlobFile(blob, filename) {
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function buildStatisticsCsv() {
    const report = getStatisticsReportSnapshot();
    const rows = [];
    const add = (...values) => rows.push(values.map(csvEscape).join(","));
    const summary = report.summary;

    add("TURNOBARBER 360 - REPORTE DE INDICADORES");
    add("Barbería", business?.name || "");
    add("Período", `${report.range.start} → ${report.range.end}`);
    add("");
    add("RESUMEN OPERATIVO");
    add("Indicador", "Valor");
    add("Turnos generados", summary.total_tickets || 0);
    add("Turnos atendidos", summary.attended || 0);
    add("Pendientes", summary.waiting || 0);
    add("En atención", summary.serving || 0);
    add("No presentados", summary.no_show || 0);
    add("Cancelaciones", summary.cancelled || 0);
    add("Ingresos estimados", Number(summary.estimated_revenue || 0));
    add("Ticket promedio", Number(summary.avg_ticket || 0));
    add("Espera promedio (min)", Number(summary.avg_wait_minutes || 0));
    add("Atención promedio (min)", Number(summary.avg_service_minutes || 0));
    add("");
    add("INGRESOS Y FINANZAS");
    add("Ingresos estimados por servicios", Number(summary.estimated_revenue || 0));
    add("Ingresos manuales", report.manualIncome);
    add("Gastos registrados", report.expenses);
    add("Ingreso estimado del período", report.estimatedPeriodIncome, "(Servicios + Manuales - Gastos)");
    add("");
    add("BARBEROS");
    add("Barbero", "Generados", "Atendidos", "Ingresos", "Espera (min)", "Atención (min)");
    report.barbers.forEach(item => add(item.barber_name, item.generated || 0, item.attended || 0, Number(item.revenue || 0), Number(item.avg_wait_minutes || 0), Number(item.avg_service_minutes || 0)));
    add("");
    add("SERVICIOS");
    add("Servicio", "Generados", "Atendidos", "Ingresos", "Espera (min)", "Atención (min)");
    report.services.forEach(item => add(item.service_name, item.generated || 0, item.attended || 0, Number(item.revenue || 0), Number(item.avg_wait_minutes || 0), Number(item.avg_service_minutes || 0)));
    add("");
    add("EVOLUCIÓN DIARIA");
    add("Día", "Generados", "Atendidos", "No presentados", "Cancelados", "Ingresos");
    report.daily.forEach(item => add((item.day || item.day_date || ""), item.generated || 0, item.attended || 0, item.no_show || 0, item.cancelled || 0, Number(item.revenue || 0)));
    add("");
    add("MOVIMIENTOS FINANCIEROS MANUALES");
    add("Fecha", "Tipo", "Categoría", "Descripción", "Valor", "Medio de pago");
    report.entries.forEach(item => add(
        item.entry_date || "",
        getFinancialEntryTypeLabel(item.entry_type),
        item.category || "",
        item.description || "",
        Number(item.amount || 0),
        item.payment_method || "No especificado"
    ));
    return rows.join("\r\n");
}

function exportStatisticsCsv() {
    if (!hasFeature("reports_csv")) {
        alert("Esta descarga no está disponible para el plan actual.");
        return;
    }
    if (!statisticsData) {
        alert("Primero carga los indicadores del período que quieres descargar.");
        return;
    }
    const report = getStatisticsReportSnapshot();
    const csv = "\uFEFF" + buildStatisticsCsv();
    downloadBlobFile(new Blob([csv], { type: "text/csv;charset=utf-8" }), `TurnoBarber360_reporte_${report.range.start}_${report.range.end}.csv`);
}

function xmlEscape(value) {
    return String(value === null || value === undefined ? "" : value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&apos;");
}

function excelCell(value, type = "String") {
    if (type === "Number" && Number.isFinite(Number(value))) {
        return `<c t="n"><v>${Number(value)}</v></c>`;
    }
    return `<c t="inlineStr"><is><t xml:space="preserve">${xmlEscape(value)}</t></is></c>`;
}

function buildExcelSheetXml() {
    const report = getStatisticsReportSnapshot();
    const rows = [];
    const addRow = cells => rows.push(`<row>${cells.join("")}</row>`);
    const textRow = (...values) => addRow(values.map(value => excelCell(value)));
    const mixedRow = values => addRow(values.map(item => excelCell(item.value, item.type || "String")));
    const summary = report.summary;

    textRow("TURNOBARBER 360 - REPORTE DE INDICADORES");
    textRow("Barbería", business?.name || "");
    textRow("Período", `${report.range.start} → ${report.range.end}`);
    textRow("");
    textRow("RESUMEN OPERATIVO");
    textRow("Indicador", "Valor");
    mixedRow([{value:"Turnos generados"},{value:Number(summary.total_tickets||0),type:"Number"}]);
    mixedRow([{value:"Turnos atendidos"},{value:Number(summary.attended||0),type:"Number"}]);
    mixedRow([{value:"Pendientes"},{value:Number(summary.waiting||0),type:"Number"}]);
    mixedRow([{value:"En atención"},{value:Number(summary.serving||0),type:"Number"}]);
    mixedRow([{value:"No presentados"},{value:Number(summary.no_show||0),type:"Number"}]);
    mixedRow([{value:"Cancelaciones"},{value:Number(summary.cancelled||0),type:"Number"}]);
    mixedRow([{value:"Ingresos estimados"},{value:Number(summary.estimated_revenue||0),type:"Number"}]);
    mixedRow([{value:"Ticket promedio"},{value:Number(summary.avg_ticket||0),type:"Number"}]);
    mixedRow([{value:"Espera promedio (min)"},{value:Number(summary.avg_wait_minutes||0),type:"Number"}]);
    mixedRow([{value:"Atención promedio (min)"},{value:Number(summary.avg_service_minutes||0),type:"Number"}]);
    textRow("");
    textRow("INGRESOS Y FINANZAS");
    mixedRow([{value:"Ingresos estimados por servicios"},{value:report.summary.estimated_revenue||0,type:"Number"}]);
    mixedRow([{value:"Ingresos manuales"},{value:report.manualIncome,type:"Number"}]);
    mixedRow([{value:"Gastos registrados"},{value:report.expenses,type:"Number"}]);
    mixedRow([{value:"Ingreso estimado del período"},{value:report.estimatedPeriodIncome,type:"Number"},{value:"(Servicios + Manuales - Gastos)"}]);
    textRow("");
    textRow("BARBEROS");
    textRow("Barbero", "Generados", "Atendidos", "Ingresos", "Espera (min)", "Atención (min)");
    report.barbers.forEach(item => mixedRow([
        {value:item.barber_name}, {value:item.generated||0,type:"Number"}, {value:item.attended||0,type:"Number"}, {value:Number(item.revenue||0),type:"Number"}, {value:Number(item.avg_wait_minutes||0),type:"Number"}, {value:Number(item.avg_service_minutes||0),type:"Number"}
    ]));
    textRow("");
    textRow("SERVICIOS");
    textRow("Servicio", "Generados", "Atendidos", "Ingresos", "Espera (min)", "Atención (min)");
    report.services.forEach(item => mixedRow([
        {value:item.service_name}, {value:item.generated||0,type:"Number"}, {value:item.attended||0,type:"Number"}, {value:Number(item.revenue||0),type:"Number"}, {value:Number(item.avg_wait_minutes||0),type:"Number"}, {value:Number(item.avg_service_minutes||0),type:"Number"}
    ]));
    textRow("");
    textRow("EVOLUCIÓN DIARIA");
    textRow("Día", "Generados", "Atendidos", "No presentados", "Cancelados", "Ingresos");
    report.daily.forEach(item => mixedRow([
        {value:(item.day || item.day_date || "")}, {value:item.generated||0,type:"Number"}, {value:item.attended||0,type:"Number"}, {value:item.no_show||0,type:"Number"}, {value:item.cancelled||0,type:"Number"}, {value:Number(item.revenue||0),type:"Number"}
    ]));
    textRow("");
    textRow("MOVIMIENTOS FINANCIEROS MANUALES");
    textRow("Fecha", "Tipo", "Categoría", "Descripción", "Valor", "Medio de pago");
    report.entries.forEach(item => mixedRow([
        {value:item.entry_date||""}, {value:getFinancialEntryTypeLabel(item.entry_type)}, {value:item.category||""}, {value:item.description||""}, {value:Number(item.amount||0),type:"Number"}, {value:item.payment_method||"No especificado"}
    ]));
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${rows.join("")}</sheetData></worksheet>`;
}

function crc32(bytes) {
    let crc = 0xFFFFFFFF;
    for (let i = 0; i < bytes.length; i++) {
        crc ^= bytes[i];
        for (let j = 0; j < 8; j++) crc = (crc >>> 1) ^ (0xEDB88320 & -(crc & 1));
    }
    return (crc ^ 0xFFFFFFFF) >>> 0;
}

function writeUint16LE(array, value) {
    array.push(value & 0xFF, (value >>> 8) & 0xFF);
}

function writeUint32LE(array, value) {
    array.push(value & 0xFF, (value >>> 8) & 0xFF, (value >>> 16) & 0xFF, (value >>> 24) & 0xFF);
}

function buildStoredZip(files) {
    const encoder = new TextEncoder();
    const output = [];
    const central = [];
    let offset = 0;

    files.forEach(file => {
        const nameBytes = encoder.encode(file.name);
        const data = typeof file.data === "string" ? encoder.encode(file.data) : file.data;
        const checksum = crc32(data);
        const local = [];
        writeUint32LE(local, 0x04034B50);
        writeUint16LE(local, 20);
        writeUint16LE(local, 0);
        writeUint16LE(local, 0);
        writeUint16LE(local, 0);
        writeUint16LE(local, 0);
        writeUint32LE(local, checksum);
        writeUint32LE(local, data.length);
        writeUint32LE(local, data.length);
        writeUint16LE(local, nameBytes.length);
        writeUint16LE(local, 0);
        output.push(...local, ...nameBytes, ...data);

        const dir = [];
        writeUint32LE(dir, 0x02014B50);
        writeUint16LE(dir, 20);
        writeUint16LE(dir, 20);
        writeUint16LE(dir, 0);
        writeUint16LE(dir, 0);
        writeUint16LE(dir, 0);
        writeUint16LE(dir, 0);
        writeUint32LE(dir, checksum);
        writeUint32LE(dir, data.length);
        writeUint32LE(dir, data.length);
        writeUint16LE(dir, nameBytes.length);
        writeUint16LE(dir, 0);
        writeUint16LE(dir, 0);
        writeUint16LE(dir, 0);
        writeUint16LE(dir, 0);
        writeUint32LE(dir, 0);
        writeUint32LE(dir, offset);
        central.push(...dir, ...nameBytes);

        offset = output.length;
    });

    const centralOffset = output.length;
    output.push(...central);
    const centralSize = central.length;
    const end = [];
    writeUint32LE(end, 0x06054B50);
    writeUint16LE(end, 0);
    writeUint16LE(end, 0);
    writeUint16LE(end, files.length);
    writeUint16LE(end, files.length);
    writeUint32LE(end, centralSize);
    writeUint32LE(end, centralOffset);
    writeUint16LE(end, 0);
    output.push(...end);

    return new Uint8Array(output);
}

function buildXlsxBlob() {
    const sheet = buildExcelSheetXml();
    const files = [
        {
            name: "[Content_Types].xml",
            data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>`
        },
        {
            name: "_rels/.rels",
            data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`
        },
        {
            name: "xl/workbook.xml",
            data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Reporte" sheetId="1" r:id="rId1"/></sheets></workbook>`
        },
        {
            name: "xl/_rels/workbook.xml.rels",
            data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>`
        },
        { name: "xl/worksheets/sheet1.xml", data: sheet }
    ];
    return new Blob([buildStoredZip(files)], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
}

function exportStatisticsExcel() {
    if (!hasFeature("reports_excel")) {
        alert("Esta descarga no está disponible para el plan actual.");
        return;
    }
    if (!statisticsData) {
        alert("Primero carga los indicadores del período que quieres descargar.");
        return;
    }
    const report = getStatisticsReportSnapshot();
    downloadBlobFile(buildXlsxBlob(), `TurnoBarber360_reporte_${report.range.start}_${report.range.end}.xlsx`);
}

function pdfEscapeText(value) {
    return String(value === null || value === undefined ? "" : value)
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^\x20-\x7E]/g, "?")
        .replace(/\\/g, "\\\\")
        .replace(/\(/g, "\\(")
        .replace(/\)/g, "\\)");
}

function buildReportPdf(pages) {
    const encoder = new TextEncoder();
    const pageWidth = 792;
    const pageHeight = 612;
    const margin = 36;
    const objects = [];
    const pageStreams = [];

    const esc = value => pdfEscapeText(value);
    const text = (stream, x, y, value, size = 9, font = "F1") => {
        stream.push(`BT /${font} ${size} Tf 1 0 0 1 ${x} ${y} Tm (${esc(value)}) Tj ET`);
    };
    const line = (stream, x1, y1, x2, y2) => {
        stream.push(`0.75 w ${x1} ${y1} m ${x2} ${y2} l S`);
    };
    const rect = (stream, x, y, w, h) => {
        stream.push(`0.92 0.94 0.98 rg ${x} ${y} ${w} ${h} re f 0 0 0 rg`);
    };
    const section = (stream, y, title) => {
        rect(stream, margin, y - 5, pageWidth - margin * 2, 22);
        text(stream, margin + 8, y + 3, title, 10, "F2");
        return y - 32;
    };
    const table = (stream, y, headers, rows, widths, rowHeight = 18, highlightLastRow = false) => {
        let x = margin;
        const totalWidth = widths.reduce((a,b)=>a+b,0);
        rect(stream, x, y - 4, totalWidth, rowHeight);
        headers.forEach((header, i) => {
            text(stream, x + 5, y + 3, header, 8, "F2");
            x += widths[i];
        });
        y -= rowHeight;
        rows.forEach((row, rowIndex) => {
            if (highlightLastRow && rowIndex === rows.length - 1) {
                stream.push(`0.86 0.92 0.99 rg ${margin} ${y - 4} ${totalWidth} ${rowHeight} re f 0 0 0 rg`);
            }
            x = margin;
            row.forEach((cell, i) => {
                const maxChars = Math.max(8, Math.floor(widths[i] / 5.1));
                const isHighlighted = highlightLastRow && rowIndex === rows.length - 1;
                text(stream, x + 5, y + 3, String(cell ?? "").slice(0, maxChars), 8, isHighlighted && i < 2 ? "F2" : "F1");
                x += widths[i];
            });
            line(stream, margin, y - 4, margin + totalWidth, y - 4);
            y -= rowHeight;
        });
        return y;
    };

    pages.forEach(page => {
        const stream = [];
        page(stream, text, line, rect, section, table);
        pageStreams.push(stream.join("\n"));
    });

    objects[1] = "<< /Type /Catalog /Pages 2 0 R >>";
    const pageObjectNumbers = [];
    const contentObjectNumbers = [];
    let objectNo = 6;
    pageStreams.forEach(() => {
        pageObjectNumbers.push(objectNo++);
        contentObjectNumbers.push(objectNo++);
    });
    objects[2] = `<< /Type /Pages /Kids [${pageObjectNumbers.map(n => `${n} 0 R`).join(" ")}] /Count ${pageStreams.length} >>`;
    objects[3] = "<< /Producer (TurnoBarber 360) >>";
    objects[4] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>";
    objects[5] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>";

    pageStreams.forEach((content, index) => {
        const contentNo = contentObjectNumbers[index];
        const pageNo = pageObjectNumbers[index];
        const length = encoder.encode(content).length;
        objects[pageNo] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Resources << /Font << /F1 4 0 R /F2 5 0 R >> >> /Contents ${contentNo} 0 R >>`;
        objects[contentNo] = `<< /Length ${length} >>\nstream\n${content}\nendstream`;
    });

    let pdf = "%PDF-1.4\n%\xFF\xFF\xFF\xFF\n";
    const offsets = [0];
    for (let i = 1; i < objects.length; i++) {
        if (!objects[i]) continue;
        offsets[i] = encoder.encode(pdf).length;
        pdf += `${i} 0 obj\n${objects[i]}\nendobj\n`;
    }
    const xref = encoder.encode(pdf).length;
    pdf += `xref\n0 ${objects.length}\n0000000000 65535 f \n`;
    for (let i = 1; i < objects.length; i++) pdf += `${String(offsets[i] || 0).padStart(10,"0")} 00000 n \n`;
    pdf += `trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
    return new Blob([encoder.encode(pdf)], { type: "application/pdf" });
}

async function loadPreviousFinancialSummary(report) {
    const previousStart = report?.comparison?.previous_start_date;
    const previousEnd = report?.comparison?.previous_end_date;

    if (!business?.id || !previousStart || !previousEnd) {
        return { manualIncome: 0, expenses: 0, estimatedPeriodIncome: Number(report?.comparison?.estimated_revenue || 0) };
    }

    const { data, error } = await client.rpc("admin_financial_entries", {
        p_business_id: business.id,
        p_start_date: previousStart,
        p_end_date: previousEnd
    });

    if (error) {
        throw error;
    }

    const entries = Array.isArray(data?.entries) ? data.entries : [];
    const manualIncome = entries
        .filter(item => item.entry_type === "income")
        .reduce((sum, item) => sum + Number(item.amount || 0), 0);
    const expenses = entries
        .filter(item => item.entry_type === "expense")
        .reduce((sum, item) => sum + Number(item.amount || 0), 0);

    const serviceRevenue = Number(report?.comparison?.estimated_revenue || 0);

    return {
        manualIncome,
        expenses,
        estimatedPeriodIncome: serviceRevenue + manualIncome - expenses
    };
}

async function exportStatisticsPdf() {
    if (!hasFeature("reports_pdf")) {
        alert("Esta descarga no está disponible para el plan actual.");
        return;
    }
    if (!statisticsData) {
        alert("Primero carga los indicadores del período que quieres descargar.");
        return;
    }
    const report = getStatisticsReportSnapshot();
    const summary = report.summary;
    const comparison = report.comparison || {};

    let previousFinancial;
    try {
        previousFinancial = await loadPreviousFinancialSummary(report);
    } catch (error) {
        console.error("ERROR CARGANDO FINANZAS DEL PERIODO ANTERIOR:", error);
        alert(error?.message || "No fue posible cargar las finanzas del período anterior para el reporte.");
        return;
    }

    const barbers = report.barbers || [];
    const services = report.services || [];
    const daily = report.daily || [];
    const entries = report.entries || [];

    const dailyChunks = [];
    for (let i = 0; i < daily.length; i += 14) dailyChunks.push(daily.slice(i, i + 14));
    if (!dailyChunks.length) dailyChunks.push([]);

    const pages = [
        (stream, text, line, rect, section, table) => {
            text(stream, 36, 568, "TURNOBARBER 360 - REPORTE DE INDICADORES", 16, "F2");
            text(stream, 36, 548, `Barberia: ${business?.name || ""}`, 10);
            text(stream, 36, 532, `Periodo: ${report.range.start} -> ${report.range.end}`, 10);
            line(stream, 36, 518, 756, 518);

            let y = section(stream, 490, "RESUMEN OPERATIVO");
            const summaryRows = [
                ["Turnos generados", summary.total_tickets || 0, "Turnos atendidos", summary.attended || 0],
                ["Pendientes", summary.waiting || 0, "En atencion", summary.serving || 0],
                ["No presentados", summary.no_show || 0, "Cancelaciones", summary.cancelled || 0],
                ["Ingresos estimados", formatMoney(summary.estimated_revenue || 0), "Ticket promedio", formatMoney(summary.avg_ticket || 0)],
                ["Espera promedio", formatStatisticsMinutes(summary.avg_wait_minutes || 0), "Atencion promedio", formatStatisticsMinutes(summary.avg_service_minutes || 0)]
            ];
            y = table(stream, y, ["Indicador", "Valor", "Indicador", "Valor"], summaryRows, [210, 150, 210, 150]);

            y -= 18;
            y = section(stream, y, "INGRESOS Y FINANZAS");
            y = table(stream, y, ["Concepto", "Valor", ""], [
                ["Ingresos estimados por servicios", formatMoney(summary.estimated_revenue || 0), ""],
                ["Ingresos manuales", formatMoney(report.manualIncome), ""],
                ["Gastos registrados", formatMoney(report.expenses), ""],
                ["Ingreso estimado del período", formatMoney(report.estimatedPeriodIncome), "(Servicios + Manuales - Gastos)"]
            ], [330, 150, 240], 20, true);

            y -= 18;
            y = section(stream, y, "BARBEROS");
            table(stream, y, ["Barbero", "Generados", "Atendidos", "Ingresos", "Espera", "Atencion"],
                barbers.map(item => [item.barber_name || "Sin barbero", item.generated || 0, item.attended || 0, formatMoney(item.revenue || 0), formatStatisticsMinutes(item.avg_wait_minutes || 0), formatStatisticsMinutes(item.avg_service_minutes || 0)]),
                [180, 90, 90, 130, 110, 120], 18);
        },
        (stream, text, line, rect, section, table) => {
            text(stream, 36, 568, "TURNOBARBER 360 - DETALLE DEL PERIODO", 16, "F2");
            text(stream, 36, 548, `Barberia: ${business?.name || ""}`, 10);
            text(stream, 36, 532, `Periodo: ${report.range.start} -> ${report.range.end}`, 10);

            let y = section(stream, 500, "SERVICIOS");
            y = table(stream, y, ["Servicio", "Generados", "Atendidos", "Ingresos", "Espera", "Atencion"],
                services.map(item => [item.service_name || "Sin servicio", item.generated || 0, item.attended || 0, formatMoney(item.revenue || 0), formatStatisticsMinutes(item.avg_wait_minutes || 0), formatStatisticsMinutes(item.avg_service_minutes || 0)]),
                [180, 90, 90, 130, 110, 120], 18);

            y -= 22;
            y = section(stream, y, dailyChunks[0].length ? "EVOLUCION DIARIA" : "EVOLUCION DIARIA");
            if (dailyChunks[0].length) {
                table(stream, y, ["Dia", "Generados", "Atendidos", "No presentados", "Cancelados", "Ingresos"],
                    dailyChunks[0].map(item => [(item.day || item.day_date || ""), item.generated || 0, item.attended || 0, item.no_show || 0, item.cancelled || 0, formatMoney(item.revenue || 0)]),
                    [145, 90, 90, 120, 100, 175], 18);
            } else {
                text(stream, 44, y + 3, "No hay datos diarios para este periodo.", 9);
            }
        }
    ];

    for (let chunkIndex = 1; chunkIndex < dailyChunks.length; chunkIndex++) {
        const chunk = dailyChunks[chunkIndex];
        pages.push((stream, text, line, rect, section, table) => {
            text(stream, 36, 568, "TURNOBARBER 360 - EVOLUCION DIARIA", 16, "F2");
            text(stream, 36, 548, `Barberia: ${business?.name || ""}`, 10);
            text(stream, 36, 532, `Periodo: ${report.range.start} -> ${report.range.end}`, 10);
            const y = section(stream, 500, `EVOLUCION DIARIA - CONTINUACION ${chunkIndex + 1}`);
            table(stream, y, ["Dia", "Generados", "Atendidos", "No presentados", "Cancelados", "Ingresos"],
                chunk.map(item => [(item.day || item.day_date || ""), item.generated || 0, item.attended || 0, item.no_show || 0, item.cancelled || 0, formatMoney(item.revenue || 0)]),
                [145, 90, 90, 120, 100, 175], 18);
        });
    }

    pages.push((stream, text, line, rect, section, table) => {
        text(stream, 36, 568, "TURNOBARBER 360 - FINANZAS", 16, "F2");
        text(stream, 36, 548, `Barberia: ${business?.name || ""}`, 10);
        text(stream, 36, 532, `Periodo: ${report.range.start} -> ${report.range.end}`, 10);

        let y = section(stream, 500, "MOVIMIENTOS FINANCIEROS MANUALES");
        if (entries.length) {
            const entryRows = entries.slice(0, 20).map(item => [item.entry_date || "", getFinancialEntryTypeLabel(item.entry_type), item.category || "", item.description || "", formatMoney(item.amount || 0)]);
            table(stream, y, ["Fecha", "Tipo", "Categoria", "Descripcion", "Valor"], entryRows, [95, 90, 135, 280, 120], 18);
            if (entries.length > 20) text(stream, 42, 92, `Se muestran los primeros 20 movimientos. Total registrados: ${entries.length}.`, 8);
        } else {
            text(stream, 44, y + 3, "No hay movimientos financieros registrados en este periodo.", 9);
        }

    });

    // Pagina final de cierre: concentra la comparacion y el resumen financiero
    // y deja una senal visual clara de que el reporte termino.
    pages.push((stream, text, line, rect, section, table) => {
        text(stream, 36, 568, "TURNOBARBER 360 - CIERRE DEL REPORTE", 16, "F2");
        text(stream, 36, 548, `Barberia: ${business?.name || ""}`, 10);
        text(stream, 36, 532, `Periodo: ${report.range.start} -> ${report.range.end}`, 10);
        line(stream, 36, 518, 756, 518);

        let y = section(stream, 490, "COMPARACION CON PERIODO ANTERIOR");
        const comparisonRows = [
            ["Turnos", formatStatisticsPercentage(comparison.tickets_change_pct)],
            ["Atendidos", formatStatisticsPercentage(comparison.attended_change_pct)],
            ["Ingresos por servicios", formatStatisticsPercentage(comparison.revenue_change_pct)]
        ];
        y = table(stream, y, ["Indicador", "Cambio"], comparisonRows, [330, 390], 20);
        text(stream, 36, y - 10, `Periodo anterior: ${comparison.previous_start_date || "—"} -> ${comparison.previous_end_date || "—"}`, 9);

        y -= 42;
        y = section(stream, y, "RESUMEN FINANCIERO DEL PERIODO ANTERIOR");
        y = table(stream, y, ["Concepto", "Valor", ""], [
            ["Ingresos estimados por servicios", formatMoney(comparison.estimated_revenue || 0), ""],
            ["Ingresos manuales", formatMoney(previousFinancial.manualIncome), ""],
            ["Gastos registrados", formatMoney(previousFinancial.expenses), ""],
            ["Ingreso estimado del periodo", formatMoney(previousFinancial.estimatedPeriodIncome), "(Servicios + Manuales - Gastos)"]
        ], [330, 150, 240], 20, true);

        // Caja final para evitar la sensacion de que faltan paginas o contenido.
        const boxY = Math.max(78, y - 28);
        stream.push(`0.94 0.98 0.99 rg ${36} ${boxY - 58} 720 58 re f 0 0 0 rg`);
        text(stream, 58, boxY - 23, "Fin del reporte", 12, "F2");
        text(stream, 58, boxY - 41, `Este reporte incluye unicamente la informacion del periodo seleccionado: ${report.range.start} -> ${report.range.end}.`, 8);
        line(stream, 36, 54, 756, 54);
        text(stream, 36, 35, "TurnoBarber 360", 9, "F2");
        text(stream, 650, 35, "Fin del reporte", 8);
    });

    downloadBlobFile(buildReportPdf(pages), `TurnoBarber360_reporte_${report.range.start}_${report.range.end}.pdf`);
}

function renderFinancialEntriesContent() {
    if (!canUseFinancialModule()) {
        return `
            <section class="card" style="margin-top:16px;">
                <div class="queue-header">
                    <div><p class="muted" style="margin:0;">Finanzas</p><h2>🔒 Registro financiero</h2></div>
                    <span class="badge">PRO / BUSINESS</span>
                </div>
                <p class="muted" style="margin:12px 0 0;">Registra ingresos adicionales y gastos de la barbería para complementar los indicadores. Disponible desde el plan PRO.</p>
            </section>
        `;
    }

    if (financialLoading) {
        return `<section class="card" style="margin-top:16px;"><p class="muted" style="margin:0;">Cargando registro financiero…</p></section>`;
    }

    if (financialError) {
        return `<section class="card" style="margin-top:16px;"><p style="margin:0 0 12px;"><strong>⚠️ No fue posible cargar el registro financiero.</strong></p><p class="muted">${escapeHtml(financialError)}</p><button type="button" class="btn primary" onclick="loadFinancialEntries()">🔄 Reintentar</button></section>`;
    }

    const entries = Array.isArray(financialEntriesData) ? financialEntriesData : [];
    const manualIncome = entries.filter(item => item.entry_type === "income").reduce((sum, item) => sum + Number(item.amount || 0), 0);
    const expenses = entries.filter(item => item.entry_type === "expense").reduce((sum, item) => sum + Number(item.amount || 0), 0);
    const result = Number(statisticsData?.summary?.estimated_revenue || 0) + manualIncome - expenses;

    const rows = entries.length ? entries.map(item => {
        const typeLabel = getFinancialEntryTypeLabel(item.entry_type);
        const sign = item.entry_type === "expense" ? "−" : "+";
        return `<tr>
            <td style="padding:8px;border-top:1px solid rgba(127,127,127,.18);">${escapeHtml(item.entry_date || "—")}</td>
            <td style="padding:8px;border-top:1px solid rgba(127,127,127,.18);">${escapeHtml(typeLabel)}</td>
            <td style="padding:8px;border-top:1px solid rgba(127,127,127,.18);">${escapeHtml(item.category || "—")}</td>
            <td style="padding:8px;border-top:1px solid rgba(127,127,127,.18);">${escapeHtml(item.description || "—")}</td>
            <td style="padding:8px;text-align:right;border-top:1px solid rgba(127,127,127,.18);">${sign}${escapeHtml(formatMoney(item.amount))}</td>
            <td style="padding:8px;border-top:1px solid rgba(127,127,127,.18);white-space:nowrap;"><button type="button" class="btn secondary" style="width:auto;margin:0 4px 0 0;padding:7px 10px;" onclick="openFinancialEntryForm('${escapeHtml(item.id)}')">Editar</button><button type="button" class="btn secondary" style="width:auto;margin:0;padding:7px 10px;" onclick="deleteFinancialEntry('${escapeHtml(item.id)}')">Eliminar</button></td>
        </tr>`;
    }).join("") : `<tr><td colspan="6" style="padding:14px;" class="muted">No hay movimientos financieros registrados en este período.</td></tr>`;

    return `
        <section class="card" style="margin-top:16px;">
            <div class="queue-header" style="gap:12px;align-items:flex-start;flex-wrap:wrap;">
                <div><p class="muted" style="margin:0;">Finanzas</p><h2>💼 Registro financiero</h2><p class="muted" style="margin:0;">Movimientos ingresados manualmente por la barbería.</p></div>
                <div style="display:flex;gap:8px;flex-wrap:wrap;"><button type="button" class="btn primary" style="width:auto;margin:0;" onclick="openFinancialEntryForm()">＋ Registrar movimiento</button><button type="button" class="btn secondary" style="width:auto;margin:0;" onclick="loadFinancialEntries()">🔄 Actualizar</button></div>
            </div>
            <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:10px;margin-top:14px;">
                <div class="status-box"><strong>Ingresos manuales</strong><div>${escapeHtml(formatMoney(manualIncome))}</div></div>
                <div class="status-box"><strong>Gastos registrados</strong><div>${escapeHtml(formatMoney(expenses))}</div></div>
                <div class="status-box"><strong>Ingreso estimado del período</strong><div>${escapeHtml(formatMoney(result))}</div></div>
            </div>
            <p class="muted" style="margin:12px 0 0;">Cálculo: ingresos estimados por servicios + ingresos manuales − gastos registrados.</p>
            </div>
            <p class="muted" style="margin:12px 0 0;">Este registro es independiente de los ingresos estimados que TurnoBarber calcula automáticamente a partir de los servicios atendidos.</p>
            <div style="overflow-x:auto;margin-top:12px;"><table style="width:100%;border-collapse:collapse;min-width:820px;"><thead><tr><th style="text-align:left;padding:8px;">Fecha</th><th style="text-align:left;padding:8px;">Tipo</th><th style="text-align:left;padding:8px;">Categoría</th><th style="text-align:left;padding:8px;">Descripción</th><th style="text-align:right;padding:8px;">Valor</th><th style="text-align:left;padding:8px;">Acciones</th></tr></thead><tbody>${rows}</tbody></table></div>
            <div style="margin-top:16px;padding-top:14px;border-top:1px solid rgba(127,127,127,.18);">
                <p class="muted" style="margin:0 0 8px;"><strong>📥 Descargar reporte</strong> · incluye indicadores, ingresos, barberos, servicios, evolución y movimientos financieros del período seleccionado.</p>
                <div style="display:flex;gap:8px;flex-wrap:wrap;">
                    ${hasFeature("reports_excel") ? `<button type="button" class="btn secondary" style="width:auto;margin:0;" onclick="exportStatisticsExcel()">📊 Excel</button>` : ""}
                    ${hasFeature("reports_csv") ? `<button type="button" class="btn secondary" style="width:auto;margin:0;" onclick="exportStatisticsCsv()">📄 CSV</button>` : ""}
                    ${hasFeature("reports_pdf") ? `<button type="button" class="btn secondary" style="width:auto;margin:0;" onclick="exportStatisticsPdf()">📕 PDF</button>` : ""}
                </div>
            </div>
        </section>
    `;
}

function renderStatisticsIndicators() {
    if (!hasFeature("advanced_indicators")) {
        return renderLockedFeatureCard(
            "Estadísticas e indicadores",
            "advanced_indicators",
            "Los indicadores avanzados, evolución y análisis del negocio requieren una suscripción PRO o BUSINESS."
        );
    }
    const range = getStatisticsDateRange();
    const button = (preset, label) => `
        <button class="btn ${statisticsPreset === preset ? "primary" : "secondary"}" type="button" onclick="setStatisticsPreset('${preset}')">${label}</button>
    `;
    return `
        <section class="card">
            <div class="queue-header" style="gap:12px;align-items:flex-start;flex-wrap:wrap;">
                <div><p class="muted" style="margin:0;">Análisis del negocio</p><h2 style="margin-bottom:4px;">📊 Estadísticas e indicadores</h2><p class="muted" style="margin:0;">Datos reales de los turnos y servicios registrados.</p></div>
                <button type="button" class="btn secondary" onclick="loadStatisticsIndicators()" ${statisticsLoading ? "disabled" : ""}>🔄 Actualizar</button>
            </div>
            <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:16px;">${button("today", "Hoy")}${button("7d", "7 días")}${button("30d", "30 días")}${button("custom", "Personalizado")}</div>
            ${statisticsPreset === "custom" ? `
                <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px;margin-top:14px;">
                    <label>Desde<input type="date" value="${escapeHtml(statisticsCustomStart || range.start)}" onchange="setStatisticsCustomDate('start', this.value)" style="width:100%;box-sizing:border-box;margin-top:6px;"></label>
                    <label>Hasta<input type="date" value="${escapeHtml(statisticsCustomEnd || range.end)}" onchange="setStatisticsCustomDate('end', this.value)" style="width:100%;box-sizing:border-box;margin-top:6px;"></label>
                </div>` : ""}
            <p class="muted" style="margin:14px 0 0;">Período: <strong>${escapeHtml(range.start)}</strong> → <strong>${escapeHtml(range.end)}</strong></p>
        </section>
        <div id="statisticsIndicatorsContainer" style="margin-top:16px;">${renderStatisticsIndicatorsContent()}</div>
    `;
}

function renderStatisticsIndicatorsContent() {
    if (!hasFeature("advanced_indicators")) {
        return renderLockedFeatureCard(
            "Estadísticas e indicadores",
            "advanced_indicators",
            "Los indicadores avanzados, evolución y análisis del negocio requieren una suscripción PRO o BUSINESS."
        );
    }
    if (statisticsLoading) return `<div class="card"><p class="muted" style="margin:0;">Consultando estadísticas…</p></div>`;
    if (statisticsError) return `<div class="card"><p style="margin:0 0 12px;"><strong>⚠️ No fue posible cargar las estadísticas.</strong></p><p class="muted">${escapeHtml(statisticsError)}</p><button type="button" class="btn primary" onclick="loadStatisticsIndicators()">🔄 Reintentar</button></div>`;
    if (!statisticsData) return `<div class="card"><p class="muted" style="margin:0;">Selecciona un período para consultar los indicadores.</p></div>`;

    const summary = statisticsData.summary || {};
    const comparison = statisticsData.comparison || {};
    const services = Array.isArray(statisticsData.services) ? statisticsData.services : [];
    const barbers = Array.isArray(statisticsData.barbers) ? statisticsData.barbers : [];
    const daily = Array.isArray(statisticsData.daily) ? statisticsData.daily : [];
    const topBarber = barbers.find(item => Number(item.attended || 0) > 0) || barbers[0] || null;
    const topServiceRevenue = [...services].sort((a,b) => Number(b.revenue || 0) - Number(a.revenue || 0))[0] || null;
    const topServiceDemand = [...services].sort((a,b) => Number(b.generated || 0) - Number(a.generated || 0))[0] || null;
    const topRevenueDay = [...daily].sort((a,b) => Number(b.revenue || 0) - Number(a.revenue || 0))[0] || null;
    const cards = [
        ["Turnos generados", Number(summary.total_tickets || 0).toLocaleString("es-CO")],
        ["Turnos atendidos", Number(summary.attended || 0).toLocaleString("es-CO")],
        ["Pendientes", Number(summary.waiting || 0).toLocaleString("es-CO")],
        ["No presentados", Number(summary.no_show || 0).toLocaleString("es-CO")],
        ["Cancelaciones", Number(summary.cancelled || 0).toLocaleString("es-CO")],
        ["Ingresos estimados", formatMoney(summary.estimated_revenue)],
        ["Ticket promedio", formatMoney(summary.avg_ticket)],
        ["Espera promedio", formatStatisticsMinutes(summary.avg_wait_minutes)],
        ["Atención promedio", formatStatisticsMinutes(summary.avg_service_minutes)]
    ];

    const rows = (items, type) => items.length ? items.map(item => {
        const name = type === "barber" ? item.barber_name : item.service_name;
        return `<tr><td style="padding:8px;border-top:1px solid rgba(127,127,127,.18);">${escapeHtml(name || "—")}</td><td style="padding:8px;text-align:center;border-top:1px solid rgba(127,127,127,.18);">${Number(item.generated || 0)}</td><td style="padding:8px;text-align:center;border-top:1px solid rgba(127,127,127,.18);">${Number(item.attended || 0)}</td><td style="padding:8px;text-align:center;border-top:1px solid rgba(127,127,127,.18);">${escapeHtml(formatMoney(item.revenue))}</td><td style="padding:8px;text-align:center;border-top:1px solid rgba(127,127,127,.18);">${escapeHtml(formatStatisticsMinutes(item.avg_wait_minutes))}</td><td style="padding:8px;text-align:center;border-top:1px solid rgba(127,127,127,.18);">${escapeHtml(formatStatisticsMinutes(item.avg_service_minutes))}</td></tr>`;
    }).join("") : `<tr><td colspan="6" style="padding:12px;" class="muted">No hay datos para este período.</td></tr>`;

    return `
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(155px,1fr));gap:10px;">${cards.map(([label,value]) => `<div class="status-box"><strong>${escapeHtml(label)}</strong><div style="font-size:1.18rem;margin-top:5px;">${escapeHtml(value)}</div></div>`).join("")}</div>
        <section class="card" style="margin-top:16px;"><div class="queue-header"><div><p class="muted" style="margin:0;">Ingresos</p><h2>💰 Ventas generadas</h2></div></div><div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:10px;margin-top:14px;"><div class="status-box"><strong>Total del período</strong><div>${escapeHtml(formatMoney(summary.estimated_revenue))}</div></div><div class="status-box"><strong>Servicios vendidos</strong><div>${Number(summary.attended || 0).toLocaleString("es-CO")}</div></div><div class="status-box"><strong>Servicio con mayor ingreso</strong><div>${escapeHtml(topServiceRevenue?.service_name || "—")}</div></div><div class="status-box"><strong>Día con mayor ingreso</strong><div>${escapeHtml(topRevenueDay?.day || "—")}</div></div></div></section>
        <section class="card" style="margin-top:16px;"><div class="queue-header"><div><p class="muted" style="margin:0;">Rendimiento</p><h2>✂️ Barberos</h2></div>${topBarber ? `<span class="badge">Más atenciones: ${escapeHtml(topBarber.barber_name || "—")}</span>` : ""}</div><div style="overflow-x:auto;margin-top:12px;"><table style="width:100%;border-collapse:collapse;min-width:620px;"><thead><tr><th style="text-align:left;padding:8px;">Barbero</th><th style="padding:8px;">Generados</th><th style="padding:8px;">Atendidos</th><th style="padding:8px;">Ingresos</th><th style="padding:8px;">Espera</th><th style="padding:8px;">Atención</th></tr></thead><tbody>${rows(barbers,"barber")}</tbody></table></div></section>
        <section class="card" style="margin-top:16px;"><div class="queue-header"><div><p class="muted" style="margin:0;">Servicios</p><h2>💈 Servicios más solicitados</h2></div>${topServiceDemand ? `<span class="badge">Más solicitado: ${escapeHtml(topServiceDemand.service_name || "—")}</span>` : ""}</div><div style="overflow-x:auto;margin-top:12px;"><table style="width:100%;border-collapse:collapse;min-width:560px;"><thead><tr><th style="text-align:left;padding:8px;">Servicio</th><th style="padding:8px;">Generados</th><th style="padding:8px;">Atendidos</th><th style="padding:8px;">Ingresos</th><th style="padding:8px;">Espera</th><th style="padding:8px;">Atención</th></tr></thead><tbody>${rows(services,"service")}</tbody></table></div></section>
        <section class="card" style="margin-top:16px;"><div class="queue-header"><div><p class="muted" style="margin:0;">Evolución</p><h2>📈 Comportamiento por día</h2></div></div>${daily.length ? `<div style="overflow-x:auto;margin-top:12px;"><table style="width:100%;border-collapse:collapse;min-width:600px;"><thead><tr><th style="text-align:left;padding:8px;">Día</th><th style="padding:8px;">Generados</th><th style="padding:8px;">Atendidos</th><th style="padding:8px;">No presentados</th><th style="padding:8px;">Cancelados</th><th style="padding:8px;">Ingresos</th></tr></thead><tbody>${daily.map(item => `<tr><td style="padding:8px;border-top:1px solid rgba(127,127,127,.18);">${escapeHtml((item.day || item.day_date || "—"))}</td><td style="padding:8px;text-align:center;border-top:1px solid rgba(127,127,127,.18);">${Number(item.generated || 0)}</td><td style="padding:8px;text-align:center;border-top:1px solid rgba(127,127,127,.18);">${Number(item.attended || 0)}</td><td style="padding:8px;text-align:center;border-top:1px solid rgba(127,127,127,.18);">${Number(item.no_show || 0)}</td><td style="padding:8px;text-align:center;border-top:1px solid rgba(127,127,127,.18);">${Number(item.cancelled || 0)}</td><td style="padding:8px;text-align:center;border-top:1px solid rgba(127,127,127,.18);">${escapeHtml(formatMoney(item.revenue))}</td></tr>`).join("")}</tbody></table></div>` : `<p class="muted">No hay movimiento registrado en este período.</p>`}</section>
        <section class="card" style="margin-top:16px;"><div class="queue-header"><div><p class="muted" style="margin:0;">Comparación</p><h2>🔎 Frente al período anterior</h2></div></div><div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:10px;margin-top:14px;"><div class="status-box"><strong>Turnos</strong><div class="${statisticsComparisonClass(comparison.tickets_change_pct)}">${escapeHtml(formatStatisticsPercentage(comparison.tickets_change_pct))}</div></div><div class="status-box"><strong>Atendidos</strong><div class="${statisticsComparisonClass(comparison.attended_change_pct)}">${escapeHtml(formatStatisticsPercentage(comparison.attended_change_pct))}</div></div><div class="status-box"><strong>Ingresos</strong><div class="${statisticsComparisonClass(comparison.revenue_change_pct)}">${escapeHtml(formatStatisticsPercentage(comparison.revenue_change_pct))}</div></div></div><p class="muted" style="margin:14px 0 0;">Comparado contra ${escapeHtml(comparison.previous_start_date || "—")} → ${escapeHtml(comparison.previous_end_date || "—")}.</p></section>
        <div id="financialEntriesContainer">${renderFinancialEntriesContent()}</div>
    `;
}


// ==========================================
// MOSTRAR PANEL
// ==========================================

const ADMIN_HOME_STYLES = `
<style id="turnobarber360-admin-home-styles">
    .tb360-home {
        display:flex;
        flex-direction:column;
        gap:14px;
        padding-bottom:10px;
    }
    .tb360-home-hero {
        display:grid;
        grid-template-columns:minmax(0,1.1fr) minmax(0,1fr);
        gap:16px;
        align-items:stretch;
        padding:18px;
        border-left:4px solid #2855D9;
        background:linear-gradient(135deg,#ffffff 0%,#f7f9ff 100%);
    }
    .tb360-home-brand {
        display:flex;
        align-items:center;
        gap:12px;
        min-width:0;
    }
    .tb360-home-brand-mark {
        width:58px;
        height:58px;
        display:grid;
        place-items:center;
        flex:0 0 58px;
        border-radius:16px;
        background:#eaf0ff;
        color:#2855D9;
        font-size:28px;
        object-fit:cover;
        overflow:hidden;
    }
    .tb360-home-meta {
        display:flex;
        flex-wrap:wrap;
        gap:6px 12px;
        margin-top:10px;
        color:#667085;
        font-size:12px;
        line-height:1.4;
    }
    .tb360-home-meta span {
        overflow-wrap:anywhere;
    }
    .settings-form-grid {
        display:grid;
        grid-template-columns:repeat(2,minmax(0,1fr));
        gap:12px;
    }
    @media (max-width:520px) {
        .settings-form-grid { grid-template-columns:1fr; }
    }
    .tb360-home-kicker { margin:0 0 4px; color:#667085; font-size:12px; font-weight:700; text-transform:uppercase; letter-spacing:.04em; }
    .tb360-home-title { margin:0; color:#172033; font-size:clamp(21px,3vw,29px); line-height:1.1; }
    .tb360-home-subtitle { margin:6px 0 0; color:#667085; font-size:13px; }
    .tb360-home-status {
        display:flex;
        flex-direction:column;
        justify-content:center;
        gap:5px;
        padding:16px;
        border-radius:16px;
        background:#e9fbf1;
        border:1px solid rgba(32,185,104,.16);
    }
    .tb360-home-status strong { color:#137545; font-size:17px; }
    .tb360-home-status span { color:#47715b; font-size:13px; line-height:1.45; }
    .tb360-home-metrics {
        display:grid;
        grid-template-columns:repeat(4,minmax(0,1fr));
        gap:10px;
    }
    .tb360-home-metric {
        min-width:0;
        padding:14px;
        border:1px solid rgba(23,32,51,.07);
        border-radius:15px;
        background:#fff;
        box-shadow:0 5px 16px rgba(23,32,51,.045);
        display:flex;
        align-items:center;
        gap:12px;
    }
    .tb360-home-metric-icon {
        width:44px;
        height:44px;
        flex:0 0 44px;
        display:grid;
        place-items:center;
        border-radius:13px;
        font-size:24px;
        line-height:1;
    }
    .tb360-home-metric-copy { min-width:0; }
    .tb360-home-metric strong { display:block; font-size:26px; line-height:1; color:#172033; }
    .tb360-home-metric span { display:block; margin-top:8px; color:#667085; font-size:12px; }
    .tb360-home-metric small { display:block; margin-top:5px; color:#667085; font-size:10px; }
    .tb360-home-metric.waiting .tb360-home-metric-icon { background:#eaf0ff; }
    .tb360-home-metric.attending .tb360-home-metric-icon { background:#fff5df; }
    .tb360-home-metric.active .tb360-home-metric-icon { background:#e6f9ef; }
    .tb360-home-metric.total .tb360-home-metric-icon { background:#eaf0ff; }
    .tb360-home-metric.waiting { border-top:3px solid #2855D9; }
    .tb360-home-metric.attending { border-top:3px solid #F4C84A; }
    .tb360-home-metric.active { border-top:3px solid #20B968; }
    .tb360-home-metric.total { border-top:3px solid #7c8cff; }
    .tb360-home-main-grid {
        display:grid;
        grid-template-columns:repeat(2,minmax(0,1fr));
        gap:14px;
    }
    .tb360-home-panel {
        min-width:0;
        padding:17px;
        border:1px solid rgba(23,32,51,.07);
        border-radius:16px;
        background:#fff;
        box-shadow:0 5px 16px rgba(23,32,51,.045);
    }
    .tb360-home-panel-head { display:flex; align-items:center; justify-content:space-between; gap:10px; margin-bottom:12px; }
    .tb360-home-panel-head h3 { margin:0; color:#172033; font-size:16px; }
    .tb360-home-panel-head .mini-label { color:#667085; font-size:11px; }
    .tb360-home-empty { display:flex; align-items:center; gap:12px; padding:13px; border-radius:12px; background:#f5f7fa; color:#667085; font-size:13px; }
    .tb360-home-empty .symbol { font-size:22px; }
    .tb360-home-current-list { display:flex; flex-direction:column; gap:8px; }
    .tb360-home-current-item { display:flex; align-items:center; justify-content:space-between; gap:10px; padding:11px 12px; border-radius:12px; background:#f5f7fa; }
    .tb360-home-current-item strong { color:#172033; font-size:13px; }
    .tb360-home-current-item span { color:#2855D9; font-weight:800; font-size:14px; }
    .tb360-home-activity { list-style:none; padding:0; margin:0; display:flex; flex-direction:column; gap:0; }
    .tb360-home-activity li { padding:10px 0; border-bottom:1px solid rgba(23,32,51,.08); font-size:13px; }
    .tb360-home-activity li:last-child { border-bottom:0; padding-bottom:0; }
    .tb360-home-barbers { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:10px; }
    .tb360-home-barber { padding:13px; border-radius:13px; background:#f7f9fc; border:1px solid rgba(23,32,51,.06); min-width:0; }
    .tb360-home-barber strong { display:block; color:#172033; font-size:13px; overflow-wrap:anywhere; }
    .tb360-home-barber .state { display:inline-flex; align-items:center; gap:5px; margin-top:7px; color:#137545; font-size:11px; font-weight:700; }
    .tb360-home-barber .state::before { content:""; width:7px; height:7px; border-radius:50%; background:#20B968; }
    .tb360-home-barber .state.busy { color:#8b6400; }
    .tb360-home-barber .state.busy::before { background:#F4C84A; }
    .tb360-home-barber .state.off { color:#667085; }
    .tb360-home-barber .state.off::before { background:#98a2b3; }
    .tb360-home-barber small { display:block; margin-top:8px; color:#667085; font-size:11px; }
    .tb360-home-actions { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:10px; }
    .tb360-home-actions .btn { min-height:46px; }
    @media (max-width:760px) {
        .tb360-home-hero, .tb360-home-main-grid { grid-template-columns:1fr; }
        .tb360-home-metrics { grid-template-columns:repeat(2,minmax(0,1fr)); }
        .tb360-home-barbers { grid-template-columns:1fr; }
        .tb360-home-brand-mark { width:48px; height:48px; flex-basis:48px; }
        .tb360-home-actions { grid-template-columns:1fr; }
    }
    @media (max-width:420px) {
        .tb360-home-metrics { gap:8px; }
        .tb360-home-metric { padding:12px; }
        .tb360-home-metric strong { font-size:23px; }
    }
</style>`;

function renderPanel() {

    adminApp.className = "admin-shell";

    adminApp.innerHTML = `
        ${ADMIN_HOME_STYLES}
        <section class="admin-tab ${activeAdminTab === "home" ? "active" : ""}" data-admin-tab="home">
            ${renderAdminHome()}
        </section>

        <section class="admin-tab ${activeAdminTab === "tickets" ? "active" : ""}" data-admin-tab="tickets">
            ${renderOperationalQueues()}
        </section>

        <section class="admin-tab ${activeAdminTab === "new" ? "active" : ""}" data-admin-tab="new">
            ${renderNewTicketAccess()}
        </section>

        <section class="admin-tab ${activeAdminTab === "barbers" ? "active" : ""}" data-admin-tab="barbers">
            ${renderBarbers()}
        </section>

        <section class="admin-tab ${activeAdminTab === "indicators" ? "active" : ""}" data-admin-tab="indicators">
            ${renderStatisticsIndicators()}
        </section>

        ${renderAdminNavigation()}

        ${adminSettingsOpen ? renderAdminSettings() : ""}
    `;

}

function showAdminTab(tab) {
    adminSettingsOpen = false;
    adminSettingsView = "menu";

    if (tab === "more") {
        tab = "home";
    }

    activeAdminTab = tab;
    saveAdminUiState();
    renderPanel();

    if (activeAdminTab === "indicators") {
        loadStatisticsIndicators();
        loadFinancialEntries();
    }
}

function renderAdminNavigation() {
    const tabs = [
        ["home", "⌂", "Inicio"],
        ["tickets", "☷", "Turnos"],
        ["new", "＋", "Nuevo turno"],
        ["barbers", "✂", "Barberos"],
        ["indicators", "▥", "Indicadores"]
    ];

    return `
        <nav
            class="admin-bottom-nav"
            aria-label="Navegación del administrador"
            style="
                display:grid;
                grid-template-columns:repeat(5, minmax(0, 1fr));
                gap:4px;
            "
        >
            ${tabs.map(([id, icon, label]) => `
                <button
                    class="admin-nav-button ${activeAdminTab === id ? "active" : ""}"
                    onclick="showAdminTab('${id}')"
                    type="button"
                    aria-current="${activeAdminTab === id ? "page" : "false"}"
                >
                    <span>${icon}</span>${label}
                </button>
            `).join("")}
        </nav>
    `;
}

function formatBusinessTime(value) {
    if (!value) return "";
    const match = String(value).match(/^(\d{2}):(\d{2})/);
    if (!match) return String(value);
    const hour = Number(match[1]);
    const minute = match[2];
    const suffix = hour >= 12 ? "p. m." : "a. m.";
    const normalizedHour = hour % 12 || 12;
    return `${normalizedHour}:${minute} ${suffix}`;
}

function getBusinessHoursLabel() {
    if (!business?.opening_time || !business?.closing_time) {
        return "Horario no configurado";
    }
    return `${formatBusinessTime(business.opening_time)} – ${formatBusinessTime(business.closing_time)}`;
}

function getBusinessTodayLabel() {
    const timezone = business?.timezone || "America/Bogota";
    try {
        return new Intl.DateTimeFormat("es-CO", {
            timeZone: timezone,
            weekday: "long",
            day: "numeric",
            month: "long",
            year: "numeric"
        }).format(new Date());
    } catch (error) {
        return "Fecha no disponible";
    }
}

function getBusinessProfileImage() {
    return business?.profile_image_url || "assets/brand/icon-maestro.png";
}

function renderAdminHome() {
    const waiting = barberQueues.reduce((total, barber) => total + Number(barber.waiting_count || 0), 0);
    const activeBarbers = myBarbers.filter(barber => barber.active !== false).length;
    const attending = barberQueues.filter(barber => barber.current_ticket_id);
    const nextQueue = barberQueues.find(barber => barber.next_ticket_code);
    const nextTicket = nextQueue?.next_ticket_code || "—";
    const statusTitle = attending.length
        ? "Atención en curso"
        : waiting > 0
            ? "Clientes en espera"
            : "Todo tranquilo por ahora";
    const statusDescription = attending.length
        ? `${attending.length} ${attending.length === 1 ? "barbero está atendiendo" : "barberos están atendiendo"}.`
        : waiting > 0
            ? `${waiting} ${waiting === 1 ? "cliente está" : "clientes están"} esperando su turno.`
            : `No hay clientes esperando ni turnos en atención.`;

    const currentContent = attending.length
        ? `<div class="tb360-home-current-list">${attending.map(barber => `
            <div class="tb360-home-current-item">
                <strong>💈 ${escapeHtml(barber.barber_name)}${barber.current_service_name ? ` · ${escapeHtml(barber.current_service_name)}` : ""}</strong>
                <span>${escapeHtml(barber.current_ticket_code || "—")}</span>
            </div>
        `).join("")}</div>`
        : `<div class="tb360-home-empty"><span class="symbol">✓</span><span>No hay turnos en atención en este momento.</span></div>`;

    const nextContent = nextQueue
        ? `<div class="tb360-home-current-item"><strong>💈 ${escapeHtml(nextQueue.barber_name || "Barbero")}</strong><span>${escapeHtml(nextTicket)}</span></div><p class="muted" style="margin:10px 0 0;font-size:12px;">Siguiente turno detectado en una de las colas.</p>`
        : `<div class="tb360-home-empty"><span class="symbol">—</span><span>No hay turnos pendientes en las colas actuales.</span></div>`;

    const barberContent = myBarbers.length
        ? `<div class="tb360-home-barbers">${myBarbers.map(barber => {
            const queue = barberQueues.find(item => item.barber_id === barber.id) || {};
            const state = barber.active === false ? "off" : queue.current_ticket_id ? "busy" : "";
            const stateLabel = barber.active === false ? "Inactivo" : queue.current_ticket_id ? "Atendiendo" : "Disponible";
            return `<div class="tb360-home-barber"><strong>${escapeHtml(barber.name)}</strong><span class="state ${state}">${stateLabel}</span><small>En espera: ${Number(queue.waiting_count || 0)}</small></div>`;
        }).join("")}</div>`
        : `<div class="tb360-home-empty"><span class="symbol">💈</span><span>Aún no hay barberos registrados.</span></div>`;

    return `
        <div class="tb360-home">
            <section class="card tb360-home-hero">
                <div class="tb360-home-brand">
                    <img class="tb360-home-brand-mark" src="${escapeHtml(getBusinessProfileImage())}" alt="Imagen de ${escapeHtml(business.name)}" onerror="this.onerror=null;this.src='assets/brand/icon-maestro.png';">
                    <div>
                        <p class="tb360-home-kicker">Resumen de la jornada</p>
                        <h2 class="tb360-home-title">${escapeHtml(business.name)}</h2>
                        <p class="tb360-home-subtitle">Panel operativo de hoy · TurnoBarber 360</p>
                        <div class="tb360-home-meta">
                            <span>📍 ${escapeHtml(business.city || "Ciudad no configurada")}</span>
                            <span>📅 ${escapeHtml(getBusinessTodayLabel())}</span>
                            <span>🕒 ${escapeHtml(getBusinessHoursLabel())}</span>
                        </div>
                    </div>
                </div>
                <div class="tb360-home-status">
                    <strong>✓ ${statusTitle}</strong>
                    <span>${statusDescription}</span>
                </div>
            </section>

            <section class="tb360-home-metrics" aria-label="Indicadores actuales">
                <div class="tb360-home-metric waiting">
                    <div class="tb360-home-metric-icon" aria-hidden="true">👥</div>
                    <div class="tb360-home-metric-copy"><strong>${waiting}</strong><span>Clientes en espera</span><small>En cola</small></div>
                </div>
                <div class="tb360-home-metric attending">
                    <div class="tb360-home-metric-icon" aria-hidden="true">✂️</div>
                    <div class="tb360-home-metric-copy"><strong>${attending.length}</strong><span>En atención</span><small>Turnos en servicio</small></div>
                </div>
                <div class="tb360-home-metric active">
                    <div class="tb360-home-metric-icon" aria-hidden="true">💈</div>
                    <div class="tb360-home-metric-copy"><strong>${activeBarbers}</strong><span>Barberos activos</span><small>De ${myBarbers.length} registrados</small></div>
                </div>
                <div class="tb360-home-metric total">
                    <div class="tb360-home-metric-icon" aria-hidden="true">👥</div>
                    <div class="tb360-home-metric-copy"><strong>${myBarbers.length}</strong><span>Total de barberos</span><small>Registrados</small></div>
                </div>
            </section>

            <section class="tb360-home-main-grid">
                <article class="tb360-home-panel">
                    <div class="tb360-home-panel-head"><h3>🎟️ Siguiente turno</h3><span class="mini-label">Colas</span></div>
                    ${nextContent}
                </article>
                <article class="tb360-home-panel">
                    <div class="tb360-home-panel-head"><h3>✂️ Atención actual</h3><span class="mini-label">En servicio</span></div>
                    ${currentContent}
                </article>
            </section>

            <section class="tb360-home-panel">
                <div class="tb360-home-panel-head"><h3>💈 Estado de barberos</h3><span class="mini-label">Equipo actual</span></div>
                ${barberContent}
            </section>

            <section class="tb360-home-panel">
                <div class="tb360-home-panel-head"><h3>⚡ Acciones rápidas</h3><span class="mini-label">Operación</span></div>
                <div class="tb360-home-actions">
                    <button class="btn primary" onclick="showAdminTab('new')">＋ Crear turno</button>
                    <button class="btn secondary" onclick="showAdminTab('tickets')">☷ Ver colas de espera</button>
                </div>
            </section>
        </div>
    `;
}

function renderRecentActivity() {
    if (!barberQueues.length) return `<p class="muted">Aún no hay actividad para mostrar.</p>`;
    return `<ul class="queue-list">${barberQueues.map(barber => `<li>💈 <strong>${escapeHtml(barber.barber_name)}</strong>: ${barber.current_ticket_code ? `atiende ${escapeHtml(barber.current_ticket_code)}` : barber.next_ticket_code ? `siguiente ${escapeHtml(barber.next_ticket_code)}` : "sin turnos pendientes"}</li>`).join("")}</ul>`;
}

function renderOperationalQueues() {
    if (!barberQueues.length) return `<section class="card empty">No hay barberos activos ni colas disponibles.</section>`;
    return `<section class="card"><div class="queue-header"><h2>Turnos por barbero</h2><span class="badge">${barberQueues.length} colas</span></div><div class="admin-barber-grid">${barberQueues.map(renderQueueCard).join("")}</div></section>`;
}

function renderQueueCard(barber) {
    const waiting = Number(barber.waiting_count || 0);
    const later = Math.max(0, waiting - (barber.next_ticket_id ? 1 : 0));
    const currentActions = barber.current_ticket_id ? `<div class="ticket-tools"><button class="btn success" onclick="finishTicket('${escapeHtml(barber.current_ticket_id)}')">Finalizar</button><button class="btn danger" onclick="noShowTicket('${escapeHtml(barber.current_ticket_id)}')">No se presentó</button></div>` : barber.next_ticket_id ? `<div class="ticket-tools"><button class="btn primary" onclick="callNext('${escapeHtml(barber.barber_id)}')">📢 Llamar ${escapeHtml(barber.next_ticket_code)}</button></div>` : `<span class="badge muted">Sin turnos</span>`;
    return `<article class="tb-barber-card"><div class="queue-header"><h3>💈 ${escapeHtml(barber.barber_name)}</h3><span class="badge ${barber.current_ticket_id ? "" : "warn"}">${barber.current_ticket_id ? "Atendiendo" : "Disponible"}</span></div><p><strong>Actual:</strong> ${barber.current_ticket_code ? escapeHtml(barber.current_ticket_code) : "—"}</p><p><strong>Siguiente:</strong> ${barber.next_ticket_code ? `${escapeHtml(barber.next_ticket_code)} · ${escapeHtml(barber.next_service_name || "Servicio")}` : "—"}</p><p><strong>Esperando:</strong> ${waiting}</p><p><strong>Posteriores:</strong> ${later}${later ? " en cola" : ""}</p>${currentActions}</article>`;
}

function renderBarberCards() {
    if (!myBarbers.length) return `<section class="card empty">Aún no hay barberos creados.</section>`;
    return `<section class="card"><div class="queue-header"><h2>Equipo de barberos</h2><button class="btn secondary" style="width:auto;margin:0;" onclick="showAdminTab('tickets')">Ver colas</button></div><div class="admin-barber-grid">${myBarbers.map(barber => { const queue = barberQueues.find(item => item.barber_id === barber.id) || {}; return `<article class="tb-barber-card"><h3>💈 ${escapeHtml(barber.name)}</h3><span class="badge ${barber.active === false ? "muted" : ""}">${barber.active === false ? "Inactivo" : "Disponible"}</span><p>Turno actual: <strong>${escapeHtml(queue.current_ticket_code || "—")}</strong></p><p>Esperando: <strong>${Number(queue.waiting_count || 0)}</strong></p><p>Atendidos hoy: <strong>—</strong></p><button class="btn secondary" onclick="showAdminTab('tickets')">Abrir cola</button></article>`; }).join("")}</div><p class="tool-note">“Atendidos hoy” no está disponible en los RPC actuales.</p></section>`;
}

function renderNewTicketAccess() {
    const activeServices = myServices.filter(service => service.active !== false);

    if (inPersonTicket) {
        return `
            <section class="card hero in-person-result">
                <span class="badge">TURNO CREADO CORRECTAMENTE</span>
                <p class="muted">El turno presencial ya está en la cola normal.</p>
                <div class="ticket-number">${escapeHtml(inPersonTicket.ticket_code || "—")}</div>
                <h2>${escapeHtml(inPersonTicket.service_name || inPersonService?.name || "Servicio")}</h2>
                <p>💈 ${escapeHtml(inPersonTicket.barber_name || inPersonBarber?.name || "Barbero")}</p>
                <div class="status-box"><strong>El cliente debe esperar su llamado.</strong></div>
                <button class="btn primary" onclick="startInPersonTicket()">＋ Crear otro turno</button>
                <button class="btn secondary" onclick="showAdminTab('tickets')">Ver colas</button>
            </section>`;
    }

    if (!inPersonService) {
        return `
            <section class="card">
                <div class="queue-header"><div><p class="muted" style="margin:0;">${escapeHtml(business.name)}</p><h2>Nuevo turno presencial</h2></div><span class="badge">PASO 1 DE 3</span></div>
                <p class="muted">Selecciona el servicio que solicita el cliente.</p>
                ${inPersonError ? `<p class="tb-form-error">${escapeHtml(inPersonError)}</p>` : ""}
                ${activeServices.length ? `<div class="tb-option-grid">${activeServices.map(service => `<button class="tb-option" type="button" onclick="selectInPersonService('${escapeHtml(service.id)}')"><strong>${escapeHtml(service.name)}</strong><span>${Number(service.duration_minutes || 0)} min · ${formatMoney(service.price)}</span></button>`).join("")}</div>` : `<div class="empty">No hay servicios activos disponibles.</div>`}
            </section>`;
    }

    if (!inPersonBarber) {
        return `
            <section class="card">
                <div class="queue-header"><div><p class="muted" style="margin:0;">Servicio seleccionado</p><h2>${escapeHtml(inPersonService.name)}</h2></div><span class="badge">PASO 2 DE 3</span></div>
                <p class="muted">Selecciona un barbero activo habilitado para este servicio.</p>
                ${inPersonError ? `<p class="tb-form-error">${escapeHtml(inPersonError)}</p>` : ""}
                ${inPersonLoadingBarbers ? `<div class="empty">Cargando barberos disponibles…</div>` : inPersonBarbers.length ? `<div class="tb-option-grid">${inPersonBarbers.map(barber => `<button class="tb-option" type="button" onclick="selectInPersonBarber('${escapeHtml(barber.id)}')"><strong>💈 ${escapeHtml(barber.name)}</strong><span>Disponible para ${escapeHtml(inPersonService.name)}</span></button>`).join("")}</div>` : `<div class="empty">No hay barberos activos habilitados para este servicio.</div>`}
                <button class="btn secondary" onclick="startInPersonTicket()">← Cambiar servicio</button>
            </section>`;
    }

    return `
        <section class="card">
            <div class="queue-header"><div><p class="muted" style="margin:0;">${escapeHtml(business.name)}</p><h2>Confirma el turno presencial</h2></div><span class="badge">PASO 3 DE 3</span></div>
            ${inPersonError ? `<p class="tb-form-error">${escapeHtml(inPersonError)}</p>` : ""}
            <div class="status-box">
                <p><strong>Servicio:</strong> ${escapeHtml(inPersonService.name)}</p>
                <p><strong>Barbero:</strong> 💈 ${escapeHtml(inPersonBarber.name)}</p>
                <p class="muted"><strong>Duración:</strong> ${Number(inPersonService.duration_minutes || 0)} min</p>
            </div>
            <button id="confirmInPersonTicket" class="btn primary" type="button" onclick="createInPersonTicket()" ${inPersonCreatingTicket ? "disabled" : ""}>${inPersonCreatingTicket ? "⏳ Creando turno…" : "✅ Confirmar turno"}</button>
            <button class="btn secondary" type="button" onclick="inPersonBarber = null; inPersonError = ''; renderPanel();" ${inPersonCreatingTicket ? "disabled" : ""}>← Cambiar barbero</button>
        </section>`;
}

function refreshNewTicketView() {
    const newTicketTab = document.querySelector('[data-admin-tab="new"]');
    if (!newTicketTab) return;

    newTicketTab.innerHTML = renderNewTicketAccess();
}

function showAdminSettings() {
    adminSettingsOpen = true;
    adminSettingsView = "menu";
    adminMoreView = "settings";
    saveAdminUiState();
    renderPanel();
}

function closeAdminSettings() {
    const overlay = document.querySelector(".admin-settings-overlay");

    if (overlay) {
        overlay.classList.add("closing");

        setTimeout(function() {
            adminSettingsOpen = false;
            adminSettingsView = "menu";
            adminMoreView = "menu";
            businessEditMessage = "";
            businessEditMessageType = "";
            saveAdminUiState();
            renderPanel();
        }, 220);

        return;
    }

    adminSettingsOpen = false;
    adminSettingsView = "menu";
    adminMoreView = "menu";
    businessEditMessage = "";
    businessEditMessageType = "";
    saveAdminUiState();
    renderPanel();
}

function selectAdminSettingsView(view) {
    adminSettingsView = view;
    if (view !== "business") {
        businessEditMessage = "";
        businessEditMessageType = "";
    }
    saveAdminUiState();

    if (document.querySelector(".admin-settings-sheet")) {
        refreshAdminSettingsContent({ resetScroll: true });
        return;
    }

    renderPanel();
}

function showAdminMore() {
    showAdminSettings();
}

function renderMoreContent() {
    return `
        <section class="card">
            <div class="queue-header">
                <div>
                    <p class="muted" style="margin:0;">Administración</p>
                    <h2>Más opciones</h2>
                </div>
                <span class="badge muted">PANEL</span>
            </div>
            <p class="tool-note">
                El acceso a estas opciones está disponible mediante el icono ⚙️ de la parte superior.
            </p>
        </section>
    `;
}

function formatBusinessFieldLabel(key) {
    const labels = {
        id: "Identificador",
        name: "Nombre",
        city: "Ciudad",
        phone: "Teléfono",
        timezone: "Zona horaria",
        qr_slug: "Identificador público",
        role: "Rol"
    };
    return labels[key] || String(key).replaceAll("_", " ");
}

function formatBusinessFieldValue(value) {
    if (typeof value === "boolean") return value ? "Sí" : "No";
    return String(value);
}

function renderBusinessReadOnlyDetails() {
    const fields = Object.entries(business || {})
        .filter(([, value]) => value !== null && value !== undefined && typeof value !== "object")
        .map(([key, value]) => `<div class="settings-row"><span>${escapeHtml(formatBusinessFieldLabel(key))}</span><strong>${escapeHtml(formatBusinessFieldValue(value))}</strong></div>`)
        .join("");

    return fields || `<p class="muted">No hay datos adicionales disponibles.</p>`;
}

function getPublicTvUrl() {
    if (!business || !business.qr_slug) return "";

    return new URL(
        `tv.html?b=${encodeURIComponent(business.qr_slug)}`,
        TURNOBARBER_PUBLIC_BASE_URL
    ).href;
}

function renderBusinessEditor() {
    return `
        <section class="card settings-business-card" style="margin:0;">
            <div class="settings-intro">
                <p class="muted" style="margin:0;">Perfil de la barbería</p>
                <h2>Mi barbería</h2>
                <p class="muted">Actualiza la información que identifica a tu negocio. El enlace público y el QR se mantienen sin cambios.</p>
            </div>

            <form onsubmit="saveBusinessProfile(event)" class="settings-business-form">
                <label for="settingsBusinessName">Nombre de la barbería</label>
                <input id="settingsBusinessName" type="text" maxlength="100" required value="${escapeHtml(business?.name || "")}" placeholder="Ej. Barbería El Jefe">

                <label for="settingsBusinessCity">Ciudad</label>
                <input id="settingsBusinessCity" type="text" maxlength="100" required value="${escapeHtml(business?.city || "")}" placeholder="Ej. Cartagena">

                <label for="settingsBusinessPhone">Teléfono</label>
                <input id="settingsBusinessPhone" type="tel" maxlength="30" value="${escapeHtml(business?.phone || "")}" placeholder="Ej. 3001234567">

                <div class="settings-form-grid">
                    <div>
                        <label for="settingsBusinessOpeningTime">Hora de apertura</label>
                        <input id="settingsBusinessOpeningTime" type="time" value="${escapeHtml((business?.opening_time || "").slice(0, 5))}">
                    </div>
                    <div>
                        <label for="settingsBusinessClosingTime">Hora de cierre</label>
                        <input id="settingsBusinessClosingTime" type="time" value="${escapeHtml((business?.closing_time || "").slice(0, 5))}">
                    </div>
                </div>

                <label for="settingsBusinessImage">Foto de perfil de la barbería</label>
                <input id="settingsBusinessImage" type="file" accept="image/png,image/jpeg,image/webp">
                <p class="muted" style="font-size:12px;margin:4px 0 0;">Formatos permitidos: JPG, PNG o WEBP. La imagen se mostrará en el dashboard.</p>

                <div id="businessEditMessage" class="tb-settings-message ${businessEditMessage ? (businessEditMessageType === "success" ? "success" : "error") : ""}"${businessEditMessage ? "" : ' style="display:none;"'}>${escapeHtml(businessEditMessage || "")}</div>

                <button class="btn primary big" type="submit" ${businessEditSaving ? "disabled" : ""}>${businessEditSaving ? "⏳ Guardando cambios..." : "Guardar cambios"}</button>
            </form>

            <div class="settings-readonly settings-business-reference">
                <div class="settings-row"><span>Identificador público</span><strong>${escapeHtml(business?.qr_slug || "—")}</strong></div>
                <div class="settings-row"><span>Zona horaria</span><strong>${escapeHtml(business?.timezone || "Configurada en el sistema")}</strong></div>
            </div>
        </section>
    `;
}

function setBusinessEditMessage(message, type) {
    const form = document.querySelector('.settings-business-form');
    if (!form) return;

    let messageElement = document.getElementById('businessEditMessage');

    if (!messageElement) {
        messageElement = document.createElement('div');
        messageElement.id = 'businessEditMessage';
        messageElement.className = 'tb-settings-message';

        const button = form.querySelector('button[type="submit"]');
        if (button) {
            form.insertBefore(messageElement, button);
        } else {
            form.appendChild(messageElement);
        }
    }

    messageElement.className = `tb-settings-message ${type === 'success' ? 'success' : 'error'}`;
    messageElement.textContent = message || '';
    messageElement.style.display = message ? 'block' : 'none';
}

async function saveBusinessProfile(event) {
    event.preventDefault();

    if (businessEditSaving) return;

    const nameInput = document.getElementById("settingsBusinessName");
    const cityInput = document.getElementById("settingsBusinessCity");
    const phoneInput = document.getElementById("settingsBusinessPhone");
    const openingTimeInput = document.getElementById("settingsBusinessOpeningTime");
    const closingTimeInput = document.getElementById("settingsBusinessClosingTime");
    const imageInput = document.getElementById("settingsBusinessImage");
    const submitButton = event.currentTarget?.querySelector('button[type="submit"]');

    const name = nameInput?.value.trim() || "";
    const city = cityInput?.value.trim() || "";
    const phone = phoneInput?.value.trim() || "";
    const openingTime = openingTimeInput?.value || null;
    const closingTime = closingTimeInput?.value || null;
    const selectedImage = imageInput?.files?.[0] || null;

    if (!name) {
        setBusinessEditMessage("El nombre de la barbería es obligatorio.", "error");
        nameInput?.focus();
        return;
    }

    if (!city) {
        setBusinessEditMessage("La ciudad es obligatoria.", "error");
        cityInput?.focus();
        return;
    }

    businessEditSaving = true;
    businessEditMessage = "";
    businessEditMessageType = "";

    if (submitButton) {
        submitButton.disabled = true;
        submitButton.textContent = "⏳ Guardando cambios...";
    }

    try {
        if ((openingTime && !closingTime) || (!openingTime && closingTime)) {
            throw new Error("Debes indicar la hora de apertura y la hora de cierre.");
        }

        if (openingTime && closingTime && closingTime <= openingTime) {
            throw new Error("La hora de cierre debe ser posterior a la hora de apertura.");
        }

        let profileImageUrl = business?.profile_image_url || null;

        if (selectedImage) {
            const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
            if (!allowedTypes.includes(selectedImage.type)) {
                throw new Error("La foto debe estar en formato JPG, PNG o WEBP.");
            }
            if (selectedImage.size > 5 * 1024 * 1024) {
                throw new Error("La foto no puede superar los 5 MB.");
            }

            const extension = selectedImage.name.split(".").pop()?.toLowerCase() || "jpg";
            const filePath = `${business.id}/${Date.now()}.${extension}`;
            const { error: uploadError } = await client.storage
                .from("business-profile-images")
                .upload(filePath, selectedImage, {
                    cacheControl: "3600",
                    upsert: true,
                    contentType: selectedImage.type
                });

            if (uploadError) throw uploadError;

            const { data: publicUrlData } = client.storage
                .from("business-profile-images")
                .getPublicUrl(filePath);
            profileImageUrl = publicUrlData?.publicUrl || profileImageUrl;
        }

        const { data, error } = await client.rpc("admin_update_business_profile", {
            p_business_name: name,
            p_city: city,
            p_phone: phone || null,
            p_opening_time: openingTime,
            p_closing_time: closingTime,
            p_profile_image_url: profileImageUrl
        });

        if (error) throw error;

        if (!data || !data.length) {
            throw new Error("No se pudo actualizar la información de la barbería.");
        }

        business = data[0];
        businessEditMessage = "Información actualizada correctamente.";
        businessEditMessageType = "success";

        if (businessInfo) {
            businessInfo.textContent = `${business.name} · ${business.city || ""}`;
        }

        setBusinessEditMessage(businessEditMessage, businessEditMessageType);
    } catch (error) {
        console.error("ERROR ACTUALIZANDO BARBERÍA:", error);
        businessEditMessage = error.message || "No se pudo guardar la información.";
        businessEditMessageType = "error";
        setBusinessEditMessage(businessEditMessage, businessEditMessageType);
    } finally {
        businessEditSaving = false;
        saveAdminUiState();

        if (submitButton) {
            submitButton.disabled = false;
            submitButton.textContent = "Guardar cambios";
        }
    }
}

function renderTvAccess() {
    const tvUrl = getPublicTvUrl();

    if (!tvUrl) {
        return `
            <section class="card" style="margin:0;">
                <h2>Pantalla TV</h2>
                <p class="muted">Todavía no hay un identificador público disponible para conectar la pantalla.</p>
            </section>
        `;
    }

    return `
        <section class="card settings-tv-card" style="margin:0;">
            <div class="settings-intro">
                <p class="muted" style="margin:0;">Conexión de pantalla</p>
                <h2>Pantalla TV</h2>
                <p class="muted">Usa este enlace en el navegador del televisor para mostrar la cola y las llamadas de ${escapeHtml(business?.name || "tu barbería")}.</p>
            </div>

            <div class="settings-tv-url">${escapeHtml(tvUrl)}</div>

            <div class="settings-action-grid">
                <button class="btn primary" type="button" onclick="copyTvLink()">Copiar enlace</button>
                <button class="btn secondary" type="button" onclick="openTvLink()">Abrir pantalla TV</button>
            </div>

            <p id="tvLinkMessage" class="tb-settings-inline-message"></p>
        </section>
    `;
}

async function copyTvLink() {
    const url = getPublicTvUrl();
    const message = document.getElementById("tvLinkMessage");
    if (!url) return;

    try {
        await navigator.clipboard.writeText(url);
        if (message) message.textContent = "Enlace de pantalla TV copiado.";
    } catch (error) {
        console.error("ERROR COPIANDO ENLACE TV:", error);
        if (message) message.textContent = "No se pudo copiar automáticamente. Puedes seleccionar el enlace y copiarlo.";
    }
}

function openTvLink() {
    const url = getPublicTvUrl();
    if (!url) return;
    window.open(url, "_blank", "noopener,noreferrer");
}

function renderAdminSettings() {

    const menuItems = [
        ["business", "🏪", "Mi barbería", "Edita la información de tu negocio"],
        ["services", "✂️", "Servicios", "Crea y administra tus servicios"],
        ["tv", "📺", "Pantalla TV", "Conecta la pantalla de tu barbería"],
        ["qr", "📱", "Página pública / QR", "Comparte el acceso de tus clientes"],
        ["subscription", "💳", "Suscripción", "Consulta tu plan y continúa con el pago"]
    ];

    let content = "";

    if (adminSettingsView === "business") {
        content = renderBusinessEditor();
    } else if (adminSettingsView === "services") {
        content = `
            <div class="settings-drawer-section">
                <div class="settings-section-title">
                    <h2>✂️ Servicios</h2>
                    <p class="muted">Crea, edita y activa o desactiva los servicios.</p>
                </div>
                ${renderServices()}
            </div>
        `;
    } else if (adminSettingsView === "barbers") {
        content = `
            <div class="settings-drawer-section">
                <div class="settings-section-title">
                    <h2>👨‍💼 Barberos</h2>
                    <p class="muted">Administra tu equipo y los servicios habilitados para cada barbero.</p>
                </div>
                ${renderBarbers()}
            </div>
        `;
    } else if (adminSettingsView === "subscription") {
        content = `
            <div class="settings-drawer-section">
                <div class="settings-section-title">
                    <h2>💳 Suscripción</h2>
                    <p class="muted">Consulta tu plan y continúa con el proceso de suscripción.</p>
                </div>
                ${renderSubscriptionCard()}
            </div>
        `;
    } else if (adminSettingsView === "tv") {
        content = `
            <div class="settings-drawer-section">
                ${renderTvAccess()}
            </div>
        `;
    } else if (adminSettingsView === "qr") {
        content = `
            <div class="settings-drawer-section">
                <div class="settings-section-title">
                    <h2>📱 Página pública / QR</h2>
                    <p class="muted">Comparte el acceso para que tus clientes puedan tomar turno.</p>
                </div>
                ${renderPublicQr()}
            </div>
        `;
    } else {
        content = `
            <div class="settings-drawer-menu">
                ${menuItems.map(([view, icon, title, description]) => `
                    <button
                        type="button"
                        class="settings-drawer-item"
                        onclick="selectAdminSettingsView('${view}')"
                    >
                        <span class="settings-drawer-icon">${icon}</span>
                        <span class="settings-drawer-copy">
                            <strong>${title}</strong>
                            <small>${description}</small>
                        </span>
                        <span class="settings-drawer-arrow">›</span>
                    </button>
                `).join("")}
            </div>

            <button
                type="button"
                class="btn"
                onclick="logout()"
                style="
                    width:100%;
                    margin-top:18px;
                "
            >
                🚪 Cerrar sesión
            </button>
        `;
    }

    const backButton = adminSettingsView === "menu"
        ? ""
        : `
            <button
                type="button"
                class="btn secondary"
                onclick="selectAdminSettingsView('menu')"
                style="width:auto;margin:0 0 14px;"
            >
                ← Mis ajustes
            </button>
        `;

    return `
        <div
            class="admin-settings-overlay"
            onclick="if(event.target === this){ closeAdminSettings(); }"
        >
            <aside
                class="admin-settings-sheet"
                role="dialog"
                aria-modal="true"
                aria-label="Mis ajustes de TurnoBarber 360"
                onclick="event.stopPropagation()"
            >
                <div class="admin-settings-handle" aria-hidden="true"></div>

                <div class="admin-settings-header">
                    <div>
                        <p class="muted" style="margin:0;font-size:12px;">Administración</p>
                        <h2 style="margin:4px 0 0;">Mis ajustes</h2>
                    </div>

                    <button
                        type="button"
                        class="admin-settings-close"
                        onclick="closeAdminSettings()"
                        aria-label="Cerrar ajustes"
                        title="Cerrar"
                    >
                        ×
                    </button>
                </div>

                <div id="adminSettingsBody">
                    <div id="adminSettingsBack">${backButton}</div>
                    <div id="adminSettingsContent">${content}</div>
                </div>
            </aside>
        </div>
    `;
}

function refreshAdminSettingsContent(options = {}) {

    const contentElement = document.getElementById("adminSettingsContent");
    const backElement = document.getElementById("adminSettingsBack");
    const sheet = document.querySelector(".admin-settings-sheet");

    if (!contentElement || !backElement || !sheet) {
        renderPanel();
        return;
    }

    const previousScrollTop = sheet.scrollTop;

    const backButton = adminSettingsView === "menu"
        ? ""
        : `
            <button
                type="button"
                class="btn secondary"
                onclick="selectAdminSettingsView('menu')"
                style="width:auto;margin:0 0 14px;"
            >
                ← Mis ajustes
            </button>
        `;

    let content = "";

    if (adminSettingsView === "business") {
        content = renderBusinessEditor();
    } else if (adminSettingsView === "services") {
        content = `
            <div class="settings-drawer-section">
                <div class="settings-section-title">
                    <h2>✂️ Servicios</h2>
                    <p class="muted">Crea, edita y activa o desactiva los servicios.</p>
                </div>
                ${renderServices()}
            </div>
        `;
    } else if (adminSettingsView === "barbers") {
        content = `
            <div class="settings-drawer-section">
                <div class="settings-section-title">
                    <h2>👨‍💼 Barberos</h2>
                    <p class="muted">Administra tu equipo y los servicios habilitados para cada barbero.</p>
                </div>
                ${renderBarbers()}
            </div>
        `;
    } else if (adminSettingsView === "subscription") {
        content = `
            <div class="settings-drawer-section">
                <div class="settings-section-title">
                    <h2>💳 Suscripción</h2>
                    <p class="muted">Consulta tu plan y continúa con el proceso de suscripción.</p>
                </div>
                ${renderSubscriptionCard()}
            </div>
        `;
    } else if (adminSettingsView === "tv") {
        content = `
            <div class="settings-drawer-section">
                ${renderTvAccess()}
            </div>
        `;
    } else if (adminSettingsView === "qr") {
        content = `
            <div class="settings-drawer-section">
                <div class="settings-section-title">
                    <h2>📱 Página pública / QR</h2>
                    <p class="muted">Comparte el acceso para que tus clientes puedan tomar turno.</p>
                </div>
                ${renderPublicQr()}
            </div>
        `;
    } else {
        const menuItems = [
            ["business", "🏪", "Mi barbería", "Edita la información de tu negocio"],
            ["services", "✂️", "Servicios", "Crea y administra tus servicios"],
            ["tv", "📺", "Pantalla TV", "Conecta la pantalla de tu barbería"],
            ["qr", "📱", "Página pública / QR", "Comparte el acceso de tus clientes"],
            ["subscription", "💳", "Suscripción", "Consulta tu plan y continúa con el pago"]
        ];

        content = `
            <div class="settings-drawer-menu">
                ${menuItems.map(([view, icon, title, description]) => `
                    <button
                        type="button"
                        class="settings-drawer-item"
                        onclick="selectAdminSettingsView('${view}')"
                    >
                        <span class="settings-drawer-icon">${icon}</span>
                        <span class="settings-drawer-copy">
                            <strong>${title}</strong>
                            <small>${description}</small>
                        </span>
                        <span class="settings-drawer-arrow">›</span>
                    </button>
                `).join("")}
            </div>

            <button
                type="button"
                class="btn"
                onclick="logout()"
                style="width:100%;margin-top:18px;"
            >
                🚪 Cerrar sesión
            </button>
        `;
    }

    backElement.innerHTML = backButton;
    contentElement.innerHTML = content;

    if (options.resetScroll) {
        sheet.scrollTop = 0;
    } else {
        sheet.scrollTop = previousScrollTop;
    }

    if (adminSettingsView === "qr") {
        generatePublicQr();
    }
}


function startInPersonTicket() {
    inPersonService = null;
    inPersonBarbers = [];
    inPersonBarber = null;
    inPersonTicket = null;
    inPersonLoadingBarbers = false;
    inPersonCreatingTicket = false;
    inPersonError = "";
    activeAdminTab = "new";
    renderPanel();
}

async function selectInPersonService(serviceId) {
    const service = myServices.find(item => item.id === serviceId && item.active !== false);
    if (!service || !business || inPersonLoadingBarbers || inPersonCreatingTicket) return;

    inPersonService = service;
    inPersonBarber = null;
    inPersonBarbers = [];
    inPersonError = "";
    inPersonLoadingBarbers = true;

    try {
        const { data, error } = await client.rpc("public_get_barbers_for_service", {
            p_business_id: business.id,
            p_service_id: service.id
        });
        if (error) throw error;
        inPersonBarbers = (data || []).filter(barber => barber.active !== false);
    } catch (error) {
        console.error("ERROR CARGANDO BARBEROS PARA TURNO PRESENCIAL:", error);
        inPersonError = error.message || "No fue posible cargar los barberos disponibles.";
    } finally {
        inPersonLoadingBarbers = false;
        refreshNewTicketView();
    }
}

function selectInPersonBarber(barberId) {
    if (inPersonCreatingTicket) return;
    const barber = inPersonBarbers.find(item => item.id === barberId);
    if (!barber) {
        inPersonError = "No se encontró el barbero seleccionado.";
        renderPanel();
        return;
    }
    inPersonBarber = barber;
    inPersonError = "";
    renderPanel();
}

async function createInPersonTicket() {
    if (!business || !inPersonService || !inPersonBarber || inPersonCreatingTicket) return;

    inPersonCreatingTicket = true;
    inPersonError = "";
    renderPanel();

    try {
        const { data, error } = await client.rpc("public_take_ticket", {
            p_business_id: business.id,
            p_service_id: inPersonService.id,
            p_barber_id: inPersonBarber.id
        });
        if (error) throw error;
        if (!data || !data.length || !data[0]?.ticket_code) {
            throw new Error("Supabase no devolvió un turno válido.");
        }

        inPersonTicket = data[0];
        try {
            await loadPanel();
        } catch (refreshError) {
            console.error("ERROR ACTUALIZANDO PANEL DESPUÉS DEL TURNO:", refreshError);
        }
    } catch (error) {
        console.error("ERROR CREANDO TURNO PRESENCIAL:", error);
        if (!inPersonTicket) {
            inPersonError = error.message || "No fue posible crear el turno. Intenta nuevamente.";
        }
    } finally {
        inPersonCreatingTicket = false;
        renderPanel();
    }
}


// ==========================================
// QR PÚBLICO DE LA BARBERÍA
// ==========================================

function renderPublicQr() {

    if (
        !business ||
        !business.qr_slug
    ) {

        return `

            <section class="card">

                <div
                    onclick="toggleAdminSection('qr')"
                    style="
                        display:flex;
                        align-items:center;
                        justify-content:space-between;
                        gap:12px;
                        cursor:pointer;
                        user-select:none;
                    "
                    role="button"
                    tabindex="0"
                    onkeydown="
                        if(event.key==='Enter'||event.key===' '){
                            event.preventDefault();
                            toggleAdminSection('qr');
                        }
                    "
                >

                    <div class="queue-header" style="flex:1; margin:0;">

                        <h2>
                            📱 QR PÚBLICO
                        </h2>

                        <span class="badge">
                            CLIENTES
                        </span>

                    </div>

                    <span
                        id="publicQrArrow"
                        style="
                            font-size:20px;
                            flex:0 0 auto;
                            transition:transform .2s ease;
                            transform:${adminPublicQrOpen ? "rotate(180deg)" : "rotate(0deg)"};
                        "
                    >
                        ▾
                    </span>

                </div>


                <div
                    style="
                        display:${adminPublicQrOpen ? "block" : "none"};
                        margin-top:20px;
                    "
                >

                    <div class="empty">

                        <p>
                            ⚠️ Esta barbería todavía no tiene
                            un identificador público disponible.
                        </p>

                    </div>

                </div>

            </section>

        `;

    }


    const publicUrl =
        new URL(
            `index.html?b=${encodeURIComponent(
                business.qr_slug
            )}`,
            TURNOBARBER_PUBLIC_BASE_URL
        ).href;


    return `

        <section class="card">

            <div
                onclick="toggleAdminSection('qr')"
                style="
                    display:flex;
                    align-items:center;
                    justify-content:space-between;
                    gap:12px;
                    cursor:pointer;
                    user-select:none;
                "
                role="button"
                tabindex="0"
                onkeydown="
                    if(event.key==='Enter'||event.key===' '){
                        event.preventDefault();
                        toggleAdminSection('qr');
                    }
                "
            >

                <div class="queue-header" style="flex:1; margin:0;">

                    <h2>
                        📱 QR PÚBLICO
                    </h2>

                    <span class="badge">
                        CLIENTES
                    </span>

                </div>

                <span
                    style="
                        font-size:20px;
                        flex:0 0 auto;
                        transition:transform .2s ease;
                        transform:${adminPublicQrOpen ? "rotate(180deg)" : "rotate(0deg)"};
                    "
                >
                    ▾
                </span>

            </div>


            <div
                id="publicQrDetails"
                style="
                    display:${adminPublicQrOpen ? "block" : "none"};
                    margin-top:20px;
                "
            >

                <p style="margin-top:0;">

                    Este es el acceso público de
                    <strong>
                        ${escapeHtml(business.name)}
                    </strong>.

                </p>


                <p class="muted">

                    Tus clientes pueden escanear este QR
                    para entrar directamente a la página
                    pública y tomar su turno.

                </p>


                <div
                    style="
                        display:flex;
                        justify-content:center;
                        margin:20px 0;
                    "
                >

                    <div
                        id="publicBusinessQr"
                        style="
                            width:250px;
                            min-height:250px;
                            display:flex;
                            align-items:center;
                            justify-content:center;
                            background:#fff;
                            border:1px solid rgba(127,127,127,0.25);
                            border-radius:14px;
                            padding:15px;
                            box-sizing:border-box;
                        "
                    >

                        <span>
                            ⏳ Generando QR...
                        </span>

                    </div>

                </div>


                <input
                    id="publicBusinessUrl"
                    type="text"
                    readonly
                    value="${escapeHtml(publicUrl)}"
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
                        onclick="event.stopPropagation(); copyPublicBusinessLink()"
                    >
                        📋 Copiar enlace
                    </button>


                    <button
                        class="btn"
                        onclick="event.stopPropagation(); sharePublicBusinessLink()"
                    >
                        📤 Compartir
                    </button>


                    <button
                        class="btn"
                        onclick="event.stopPropagation(); downloadPublicQr()"
                    >
                        ⬇️ Guardar QR
                    </button>

                </div>


                <p
                    id="publicBusinessQrMessage"
                    style="
                        margin-top:12px;
                        text-align:center;
                    "
                ></p>


                <p
                    class="muted"
                    style="
                        font-size:12px;
                        text-align:center;
                        margin-bottom:0;
                    "
                >
                    Este QR es permanente y corresponde
                    a la página pública de tu barbería.

                </p>

            </div>

        </section>

    `;

}


// ==========================================
// GENERAR QR PÚBLICO
// ==========================================

async function generatePublicQr() {

    const container =
        document.getElementById(
            "publicBusinessQr"
        );


    if (
        !container ||
        !business ||
        !business.qr_slug
    ) {

        return;

    }


    const publicUrl =
        new URL(
            `index.html?b=${encodeURIComponent(
                business.qr_slug
            )}`,
            TURNOBARBER_PUBLIC_BASE_URL
        ).href;


    try {

        await loadQrLibrary();


        if (
            typeof QRCode ===
            "undefined"
        ) {

            throw new Error(
                "El generador QR no está disponible."
            );

        }


        container.innerHTML =
            "";


        new QRCode(
            container,
            {
                text:
                    publicUrl,

                width:
                    220,

                height:
                    220,

                correctLevel:
                    QRCode.CorrectLevel.M
            }
        );


    } catch (error) {

        console.error(
            "ERROR GENERANDO QR PÚBLICO:",
            error
        );


        container.innerHTML = `

            <div style="padding:20px; text-align:center;">

                <strong>
                    ⚠️ No se pudo generar el QR.
                </strong>

                <p style="font-size:12px;">
                    Puedes utilizar el enlace
                    para compartir la página pública.
                </p>

            </div>

        `;

    }

}


// ==========================================
// CARGAR LIBRERÍA QR
// ==========================================

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


// ==========================================
// COPIAR ENLACE PÚBLICO
// ==========================================

async function copyPublicBusinessLink() {

    const input =
        document.getElementById(
            "publicBusinessUrl"
        );


    const message =
        document.getElementById(
            "publicBusinessQrMessage"
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
                "✅ Enlace público copiado.";

        }


    } catch (error) {

        input.select();


        document.execCommand(
            "copy"
        );


        if (message) {

            message.textContent =
                "✅ Enlace público copiado.";

        }

    }

}


// ==========================================
// COMPARTIR ENLACE PÚBLICO
// ==========================================

async function sharePublicBusinessLink() {

    const input =
        document.getElementById(
            "publicBusinessUrl"
        );


    const message =
        document.getElementById(
            "publicBusinessQrMessage"
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
                        `TurnoBarber 360 - ${business.name}`,

                    text:
                        `Toma tu turno en ${business.name}`,

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


    await copyPublicBusinessLink();


    if (message) {

        message.textContent =
            "📋 El enlace fue copiado para compartirlo.";

    }

}


// ==========================================
// GUARDAR QR PÚBLICO
// ==========================================

function downloadPublicQr() {

    const qrContainer =
        document.getElementById(
            "publicBusinessQr"
        );


    const message =
        document.getElementById(
            "publicBusinessQrMessage"
        );


    if (!qrContainer) {
        return;
    }


    const canvas =
        qrContainer.querySelector(
            "canvas"
        );


    const image =
        qrContainer.querySelector(
            "img"
        );


    let dataUrl =
        null;


    if (canvas) {

        dataUrl =
            canvas.toDataURL(
                "image/png"
            );

    } else if (image) {

        dataUrl =
            image.src;

    }


    if (!dataUrl) {

        if (message) {

            message.textContent =
                "⚠️ El QR todavía no está listo.";

        }

        return;

    }


    const link =
        document.createElement(
            "a"
        );


    link.href =
        dataUrl;


    link.download =
        `turnobarber-${business.qr_slug || "qr"}.png`;


    document.body.appendChild(
        link
    );


    link.click();


    link.remove();


    if (message) {

        message.textContent =
            "✅ QR preparado para guardar.";

    }

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


// ==========================================
// ELIMINAR BARBERO DE FORMA SEGURA
// ==========================================

async function deleteBarber(
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

    const confirmed =
        confirm(
            `¿Eliminar a ${barber.name}?\n\nEsta acción elimina el registro del barbero y sus accesos asociados. Si el barbero tiene turnos registrados, TurnoBarber 360 no permitirá eliminarlo para proteger el historial; en ese caso debes desactivarlo.`
        );

    if (!confirmed) {

        return;

    }

    const {
        data,
        error
    } =
        await client.rpc(
            "admin_delete_barber",
            {
                p_barber_id:
                    barberId
            }
        );

    if (error) {

        console.error(
            "ERROR ELIMINANDO BARBERO:",
            error
        );

        alert(
            error.message
        );

        return;

    }

    if (!data) {

        alert(
            "No se pudo eliminar el barbero."
        );

        return;

    }

    openAdminAccordions.delete(
        `barberDetails-${barberId}`
    );

    saveAdminUiState();

    await loadBarbers();

    renderPanel();

}

function renderBarbers() {

    return `

        <section class="card">

            <div
                onclick="toggleAdminSection('barbers')"
                style="
                    display:flex;
                    align-items:center;
                    justify-content:space-between;
                    gap:12px;
                    cursor:pointer;
                    user-select:none;
                "
                role="button"
                tabindex="0"
                onkeydown="
                    if(event.key==='Enter'||event.key===' '){
                        event.preventDefault();
                        toggleAdminSection('barbers');
                    }
                "
            >

                <div class="queue-header" style="flex:1; margin:0;">

                    <h2>
                        👨‍💼 MIS BARBEROS
                    </h2>

                    <span class="badge">
                        ${myBarbers.length}
                        barberos
                    </span>

                </div>

                <span
                    style="
                        font-size:20px;
                        flex:0 0 auto;
                        transition:transform .2s ease;
                        transform:${adminBarbersSectionOpen ? "rotate(180deg)" : "rotate(0deg)"};
                    "
                >
                    ▾
                </span>

            </div>


            <button
                class="btn primary"
                onclick="event.stopPropagation(); openBarbersAndCreateForm()"
                style="margin-top:16px;"
            >
                ➕ Nuevo barbero
            </button>


            <div
                id="barberSectionDetails"
                style="
                    display:${adminBarbersSectionOpen ? "block" : "none"};
                    margin-top:20px;
                "
            >

                <div
                    id="barberFormContainer"
                ></div>


                <div style="margin-top:20px;">

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
                        <div
                            class="queue"
                            style="
                                display:flex;
                                flex-direction:column;
                                gap:10px;
                            "
                        >

                            ${
                                myBarbers.map(barber => {

                                    const detailsId =
                                        `barberDetails-${barber.id}`;

                                    const isOpen =
                                        openAdminAccordions.has(
                                            detailsId
                                        );

                                    return `

                                        <div
                                            class="queue-item"
                                            style="
                                                margin-bottom:0;
                                                display:block;
                                                padding:0;
                                                overflow:hidden;
                                            "
                                        >

                                            <div
                                                onclick="toggleAdminAccordion('${detailsId}')"
                                                style="
                                                    display:flex;
                                                    align-items:center;
                                                    justify-content:space-between;
                                                    gap:12px;
                                                    padding:16px;
                                                    cursor:pointer;
                                                    user-select:none;
                                                "
                                                role="button"
                                                tabindex="0"
                                                onkeydown="
                                                    if(event.key==='Enter'||event.key===' '){
                                                        event.preventDefault();
                                                        toggleAdminAccordion('${detailsId}');
                                                    }
                                                "
                                            >

                                                <div
                                                    style="
                                                        min-width:0;
                                                        display:flex;
                                                        align-items:center;
                                                        gap:8px;
                                                        flex-wrap:wrap;
                                                    "
                                                >

                                                    <strong>
                                                        👤 ${escapeHtml(barber.name)}
                                                    </strong>

                                                    <span class="badge">
                                                        ${barber.active ? "🟢 Activo" : "🔴 Inactivo"}
                                                    </span>

                                                </div>

                                                <span
                                                    id="${detailsId}-arrow"
                                                    style="
                                                        font-size:20px;
                                                        flex:0 0 auto;
                                                        transition:transform .2s ease;
                                                        transform:${isOpen ? "rotate(180deg)" : "rotate(0deg)"};
                                                    "
                                                >
                                                    ▾
                                                </span>

                                            </div>


                                            <div
                                                id="${detailsId}"
                                                style="
                                                    display:${isOpen ? "block" : "none"};
                                                    padding:0 16px 16px;
                                                    border-top:1px solid rgba(127,127,127,0.18);
                                                "
                                            >

                                                <div
                                                    style="
                                                        display:flex;
                                                        flex-direction:column;
                                                        gap:8px;
                                                        padding-top:14px;
                                                    "
                                                >

                                                    ${
                                                        barber.active

                                                        ?

                                                        `
                                                        <button
                                                            class="btn success"
                                                            onclick="event.stopPropagation(); toggleBarber('${barber.id}', false)"
                                                        >
                                                            🟢 Activo
                                                        </button>
                                                        `

                                                        :

                                                        `
                                                        <button
                                                            class="btn danger"
                                                            onclick="event.stopPropagation(); toggleBarber('${barber.id}', true)"
                                                        >
                                                            🔴 Inactivo
                                                        </button>
                                                        `
                                                    }


                                                    <button
                                                        class="btn"
                                                        onclick="event.stopPropagation(); showEditBarberForm('${barber.id}')"
                                                    >
                                                        ✏️ Editar
                                                    </button>


                                                    <button
                                                        class="btn primary"
                                                        onclick="event.stopPropagation(); showBarberServicesForm('${barber.id}')"
                                                    >
                                                        ⚙️ Servicios
                                                    </button>


                                                    <button
                                                        class="btn"
                                                        onclick="event.stopPropagation(); createBarberInvitation('${barber.id}')"
                                                    >
                                                        🔐 Dar acceso
                                                    </button>

                                                    <button
                                                        class="btn danger"
                                                        onclick="event.stopPropagation(); deleteBarber('${barber.id}')"
                                                    >
                                                        🗑️ Eliminar
                                                    </button>

                                                </div>

                                            </div>

                                        </div>

                                    `;

                                }).join("")
                            }

                        </div>
                        `
                    }

                </div>

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
            new URL(
                `barbero.html?token=${encodeURIComponent(token)}`,
                TURNOBARBER_PUBLIC_BASE_URL
            ).href;

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
                        "Acceso TurnoBarber 360",
                    text:
                        "Acceso de barbero a TurnoBarber 360",
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
// MODALES DEL ADMINISTRADOR
// ==========================================

function closeAdminModal() {
    const modal = document.getElementById("adminActionModal");
    if (modal) {
        modal.remove();
    }
}

function createAdminModal(title, contentHtml) {
    closeAdminModal();

    const modal = document.createElement("div");
    modal.id = "adminActionModal";
    modal.style.cssText = `
        position:fixed;
        inset:0;
        z-index:10000;
        background:rgba(0,0,0,.58);
        display:flex;
        align-items:flex-start;
        justify-content:center;
        padding:16px;
        box-sizing:border-box;
        overflow-y:auto;
    `;

    modal.innerHTML = `
        <div
            class="card"
            style="
                width:min(520px,100%);
                margin:20px auto;
                max-height:calc(100vh - 40px);
                overflow-y:auto;
                box-sizing:border-box;
                position:relative;
                padding:20px;
            "
        >
            <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px;">
                <h2 style="margin:0;">${escapeHtml(title)}</h2>
                <button
                    type="button"
                    class="btn secondary"
                    onclick="closeAdminModal()"
                    aria-label="Cerrar"
                    style="width:40px;height:40px;min-width:40px;padding:0;margin:0;border-radius:50%;"
                >✕</button>
            </div>
            <div id="adminActionModalContent" style="margin-top:18px;">${contentHtml}</div>
        </div>
    `;

    modal.addEventListener("click", event => {
        if (event.target === modal) {
            closeAdminModal();
        }
    });

    document.body.appendChild(modal);
    return document.getElementById("adminActionModalContent");
}

// ==========================================
// FORMULARIO EDITAR BARBERO
// ==========================================

function showEditBarberForm(
    barberId
) {

    const barber = myBarbers.find(b => b.id === barberId);

    if (!barber) {
        alert("No se encontró el barbero.");
        return;
    }

    createAdminModal(
        `Editar barbero`,
        `
            <p class="muted" style="margin-top:0;">Actualiza el nombre de ${escapeHtml(barber.name)}.</p>
            <div style="margin-bottom:14px;">
                <label for="editBarberName">Nombre</label>
                <input
                    id="editBarberName"
                    type="text"
                    value="${escapeHtml(barber.name)}"
                    maxlength="100"
                    style="width:100%;box-sizing:border-box;padding:12px;margin-top:6px;"
                >
            </div>
            <button class="btn primary" type="button" onclick="updateBarber('${barber.id}')" style="width:100%;">
                💾 Guardar cambios
            </button>
            <p id="barberFormMessage" style="margin:12px 0 0;"></p>
        `
    );

    setTimeout(() => {
        const input = document.getElementById("editBarberName");
        if (input) {
            input.focus();
            input.select();
        }
    }, 0);
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


    closeAdminModal();

    // Mantener abierto el acordeón del barbero que se acaba de editar.
    openAdminAccordions.add(`barberDetails-${barberId}`);
    saveAdminUiState();

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

    const barber = myBarbers.find(b => b.id === barberId);

    if (!barber) {
        alert("No se encontró el barbero.");
        return;
    }

    barberServiceEditorOpen = true;
    barberServiceEditorBarberId = barberId;

    createAdminModal(
        `Servicios de ${barber.name}`,
        `
            <p class="muted" style="margin-top:0;">Selecciona los servicios que este barbero puede realizar.</p>
            <div id="barberServicesEditorContent">
                <div class="empty"><p>⏳ Cargando servicios...</p></div>
            </div>
        `
    );

    try {
        const { data, error } = await client.rpc("admin_barber_services", {
            p_barber_id: barberId
        });

        if (error) {
            throw error;
        }

        const services = data || [];
        const editor = document.getElementById("barberServicesEditorContent");

        if (!editor) {
            return;
        }

        if (services.length === 0) {
            editor.innerHTML = `
                <div class="empty">
                    <p>No tienes servicios creados todavía.</p>
                    <p>Primero crea servicios en <strong>Mis servicios</strong>.</p>
                    <button class="btn secondary" type="button" onclick="closeBarberServicesForm()" style="margin-top:8px;width:100%;">← Volver</button>
                </div>
            `;
            return;
        }

        editor.innerHTML = `
            <div style="display:flex;flex-direction:column;gap:10px;">
                ${services.map(service => `
                    <label style="display:flex;align-items:center;justify-content:space-between;gap:10px;padding:14px;border:1px solid rgba(127,127,127,.25);border-radius:12px;cursor:${service.active ? "pointer" : "default"};opacity:${service.active ? "1" : ".65"};">
                        <span style="display:flex;align-items:center;gap:10px;min-width:0;">
                            <input type="checkbox" data-barber-service-id="${service.id}" ${service.assigned ? "checked" : ""} ${service.active ? "" : "disabled"} style="width:20px;height:20px;flex:0 0 auto;">
                            <span style="min-width:0;">
                                <strong style="display:block;">${escapeHtml(service.name)}</strong>
                                <small>$${Number(service.price || 0).toLocaleString("es-CO")} · ${Number(service.duration_minutes || 0)} min</small>
                            </span>
                        </span>
                        <span class="badge">${service.active ? (service.assigned ? "Asignado" : "No asignado") : "Inactivo"}</span>
                    </label>
                `).join("")}
            </div>
            <p id="barberServicesFormMessage" style="margin:14px 0 0;"></p>
            <button class="btn primary" type="button" onclick="saveBarberServices('${barberId}')" style="width:100%;margin-top:12px;">💾 Guardar cambios</button>
            <button class="btn secondary" type="button" onclick="closeBarberServicesForm()" style="width:100%;margin-top:8px;">Cancelar</button>
        `;

    } catch (error) {
        console.error("ERROR CARGANDO SERVICIOS DEL BARBERO:", error);
        const editor = document.getElementById("barberServicesEditorContent");
        if (editor) {
            editor.innerHTML = `
                <div class="empty">
                    <p>❌ ${escapeHtml(error.message)}</p>
                    <button class="btn secondary" type="button" onclick="closeBarberServicesForm()" style="margin-top:8px;width:100%;">← Volver</button>
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
        closeAdminModal();

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
    closeAdminModal();

    renderPanel();

}


// ==========================================
// ACORDEONES DEL PANEL ADMIN
// ==========================================

function toggleAdminAccordion(detailsId) {

    if (!detailsId) {
        return;
    }

    if (openAdminAccordions.has(detailsId)) {
        openAdminAccordions.delete(detailsId);
    } else {
        openAdminAccordions.add(detailsId);
    }

    saveAdminUiState();

    if (document.querySelector(".admin-settings-sheet")) {
        refreshAdminSettingsContent();
        return;
    }

    renderPanel();

}


// ==========================================
// ACORDEONES PRINCIPALES DEL ADMINISTRADOR
// ==========================================

function toggleAdminSection(section) {

    if (section === "qr") {

        adminPublicQrOpen =
            !adminPublicQrOpen;

    }

    if (section === "barbers") {

        adminBarbersSectionOpen =
            !adminBarbersSectionOpen;

    }

    if (section === "services") {

        adminServicesSectionOpen =
            !adminServicesSectionOpen;

        saveAdminUiState();

        const sheet =
            document.querySelector(".admin-settings-sheet");

        const details =
            document.getElementById("serviceSectionDetails");

        if (sheet && details) {

            // Cambiamos únicamente el acordeón de Servicios.
            // No reconstruimos el contenido del panel ni la hoja,
            // evitando el salto visual al abrir/cerrar.
            details.style.display =
                adminServicesSectionOpen
                    ? "block"
                    : "none";

            const header =
                details.parentElement
                    ? details.parentElement.querySelector(
                        "div[role=\"button\"] span:last-child"
                    )
                    : null;

            if (header) {
                header.style.transform =
                    adminServicesSectionOpen
                        ? "rotate(180deg)"
                        : "rotate(0deg)";
            }

            return;
        }
    }

    saveAdminUiState();
    renderPanel();
}


// ==========================================
// ABRIR BARBEROS Y NUEVO BARBERO
// ==========================================

function openBarbersAndCreateForm() {

    adminBarbersSectionOpen = true;
    saveAdminUiState();

    renderPanel();

    setTimeout(
        function() {
            showCreateBarberForm();
        },
        0
    );

}


// ==========================================
// RENDERIZAR SERVICIOS
// ==========================================

function renderServices() {

    return `

        <section class="card">

            <div
                onclick="toggleAdminSection('services')"
                style="
                    display:flex;
                    align-items:center;
                    justify-content:space-between;
                    gap:12px;
                    cursor:pointer;
                    user-select:none;
                "
                role="button"
                tabindex="0"
                onkeydown="
                    if(event.key==='Enter'||event.key===' '){
                        event.preventDefault();
                        toggleAdminSection('services');
                    }
                "
            >

                <div class="queue-header" style="flex:1; margin:0;">

                    <h2>
                        ⚙️ MIS SERVICIOS
                    </h2>

                    <span class="badge">
                        ${myServices.length}
                        servicios
                    </span>

                </div>

                <span
                    style="
                        font-size:20px;
                        flex:0 0 auto;
                        transition:transform .2s ease;
                        transform:${adminServicesSectionOpen ? "rotate(180deg)" : "rotate(0deg)"};
                    "
                >
                    ▾
                </span>

            </div>


            <button
                class="btn primary"
                onclick="event.stopPropagation(); openServicesAndCreateForm()"
                style="margin-top:16px;"
            >
                ➕ Nuevo servicio
            </button>


            <div
                id="serviceSectionDetails"
                style="
                    display:${adminServicesSectionOpen ? "block" : "none"};
                    margin-top:20px;
                "
            >

                <div
                    id="serviceFormContainer"
                ></div>


                <div style="margin-top:20px;">

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
                        <div
                            class="queue"
                            style="
                                display:flex;
                                flex-direction:column;
                                gap:10px;
                            "
                        >

                            ${
                                myServices.map(service => {

                                    const detailsId =
                                        `serviceDetails-${service.id}`;

                                    const isOpen =
                                        openAdminAccordions.has(
                                            detailsId
                                        );

                                    return `

                                        <div
                                            class="queue-item"
                                            style="
                                                margin-bottom:0;
                                                display:block;
                                                padding:0;
                                                overflow:hidden;
                                            "
                                        >

                                            <div
                                                onclick="toggleAdminAccordion('${detailsId}')"
                                                style="
                                                    display:flex;
                                                    align-items:center;
                                                    justify-content:space-between;
                                                    gap:12px;
                                                    padding:16px;
                                                    cursor:pointer;
                                                    user-select:none;
                                                "
                                                role="button"
                                                tabindex="0"
                                                onkeydown="
                                                    if(event.key==='Enter'||event.key===' '){
                                                        event.preventDefault();
                                                        toggleAdminAccordion('${detailsId}');
                                                    }
                                                "
                                            >

                                                <div
                                                    style="
                                                        min-width:0;
                                                        display:flex;
                                                        flex-direction:column;
                                                        gap:5px;
                                                    "
                                                >

                                                    <div
                                                        style="
                                                            display:flex;
                                                            align-items:center;
                                                            gap:8px;
                                                            flex-wrap:wrap;
                                                        "
                                                    >

                                                        <strong>
                                                            ${escapeHtml(service.name)}
                                                        </strong>

                                                        <span class="badge">
                                                            ${service.active ? "🟢 Activo" : "🔴 Inactivo"}
                                                        </span>

                                                    </div>

                                                    <span class="muted">
                                                        $${Number(service.price || 0).toLocaleString("es-CO")}
                                                        ·
                                                        ${service.duration_minutes}
                                                        min
                                                    </span>

                                                </div>

                                                <span
                                                    id="${detailsId}-arrow"
                                                    style="
                                                        font-size:20px;
                                                        flex:0 0 auto;
                                                        transition:transform .2s ease;
                                                        transform:${isOpen ? "rotate(180deg)" : "rotate(0deg)"};
                                                    "
                                                >
                                                    ▾
                                                </span>

                                            </div>


                                            <div
                                                id="${detailsId}"
                                                style="
                                                    display:${isOpen ? "block" : "none"};
                                                    padding:0 16px 16px;
                                                    border-top:1px solid rgba(127,127,127,0.18);
                                                "
                                            >

                                                <div
                                                    style="
                                                        display:flex;
                                                        flex-direction:column;
                                                        gap:8px;
                                                        padding-top:14px;
                                                    "
                                                >

                                                    ${
                                                        service.active

                                                        ?

                                                        `
                                                        <button
                                                            class="btn success"
                                                            onclick="event.stopPropagation(); toggleService('${service.id}', false)"
                                                        >
                                                            🟢 Activo
                                                        </button>
                                                        `

                                                        :

                                                        `
                                                        <button
                                                            class="btn danger"
                                                            onclick="event.stopPropagation(); toggleService('${service.id}', true)"
                                                        >
                                                            🔴 Inactivo
                                                        </button>
                                                        `
                                                    }


                                                    <button
                                                        class="btn"
                                                        onclick="event.stopPropagation(); showEditServiceForm('${service.id}')"
                                                    >
                                                        ✏️ Editar
                                                    </button>

                                                </div>

                                            </div>

                                        </div>

                                    `;

                                }).join("")
                            }

                        </div>
                        `
                    }

                </div>

            </div>

        </section>

    `;

}


// ==========================================
// ABRIR SERVICIOS Y NUEVO SERVICIO
// ==========================================

function openServicesAndCreateForm() {

    adminServicesSectionOpen = true;
    saveAdminUiState();

    if (document.querySelector(".admin-settings-sheet")) {
        refreshAdminSettingsContent({ resetScroll: false });
        setTimeout(showCreateServiceForm, 0);
        return;
    }

    renderPanel();

    setTimeout(
        function() {
            showCreateServiceForm();
        },
        0
    );

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

    if (document.querySelector(".admin-settings-sheet")) {
        refreshAdminSettingsContent();
        setTimeout(showCreateServiceForm, 0);
        return;
    }

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


    // Mantener abierto el acordeón del servicio que se acaba de editar.
    openAdminAccordions.add(`serviceDetails-${serviceId}`);
    saveAdminUiState();

    await loadServices();

    if (document.querySelector(".admin-settings-sheet")) {
        refreshAdminSettingsContent();
        return;
    }

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

    if (document.querySelector(".admin-settings-sheet")) {
        refreshAdminSettingsContent();
        return;
    }

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
// DETECTAR INTERFAZ TRANSITORIA ABIERTA
// ==========================================
// No debemos reconstruir renderPanel() mientras el administrador está
// escribiendo o tiene un cuadro/modal abierto. Si lo hiciéramos, el DOM
// se reemplaza y el formulario desaparece durante la actualización automática.
function hasTransientAdminUiOpen() {

    if (barberServiceEditorOpen) {
        return true;
    }

    if (document.getElementById("adminActionModal")) {
        return true;
    }

    if (document.getElementById("newBarberName")) {
        return true;
    }

    if (document.getElementById("newServiceName")) {
        return true;
    }

    if (document.getElementById("editBarberName")) {
        return true;
    }

    if (document.getElementById("editServiceName")) {
        return true;
    }

    return false;
}


// ==========================================
// ACTUALIZACIÓN AUTOMÁTICA
// ==========================================

setInterval(
    async function() {

        if (!business) {

            return;

        }

        // Siempre podemos actualizar los datos en memoria.
        await loadBarberQueues();
        await loadServices();
        await loadBarbers();

        // Si hay una interfaz que el administrador está usando, NO
        // reconstruimos el DOM. Esto evita el parpadeo y, sobre todo,
        // evita cerrar formularios, modales o cuadros abiertos.
        if (adminSettingsOpen || hasTransientAdminUiOpen()) {
            return;
        }

        renderPanel();

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


// ==========================================
// GENERAR QR DESPUÉS DE PINTAR EL PANEL
// ==========================================
//
// Se ejecuta después de que renderPanel()
// haya creado el contenedor del QR.
// ==========================================

const originalRenderPanel =
    renderPanel;

renderPanel = function() {

    originalRenderPanel();

    generatePublicQr();

};

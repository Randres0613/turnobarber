const app = document.getElementById("app");
const statusEl = document.getElementById("status");

const slug =
    new URLSearchParams(location.search).get("b")
    || "barberia-el-jefe";

let business = null;
let services = [];

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
                <p>${error.message}</p>
            </div>
        `;

        return;
    }

    if (!data || data.length === 0) {

        statusEl.textContent = "No encontrada";

        app.innerHTML = `
            <div class="card hero">
                <h2>💈 No encontramos la barbería</h2>
                <p>Buscamos:</p>
                <strong>${slug}</strong>
            </div>
        `;

        return;
    }

    business = data[0];

    await loadServices();
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
                <h2>⚠️ Error cargando servicios</h2>
                <p>${error.message}</p>
            </div>
        `;

        return;
    }

    services = data || [];

    statusEl.textContent = "Conectado";

    renderCustomer();
}


// ==========================================
// MOSTRAR BARBERÍA Y SERVICIOS
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
                                            🎟️ Tomar turno
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
                Estamos registrando tu turno.
            </p>

        </div>

    `;


    // ======================================
    // CREAR TURNO EN SUPABASE
    // ======================================

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
                    ⚠️ No pudimos crear el turno
                </h2>

                <p>
                    ${error.message}
                </p>

                <button
                    class="btn"
                    onclick="renderCustomer()"
                >
                    Volver a servicios
                </button>

            </div>

        `;

        return;
    }


    // ======================================
    // COMPROBAR RESPUESTA
    // ======================================

    if (!data || data.length === 0) {

        app.innerHTML = `

            <div class="card hero">

                <h2>
                    ⚠️ No recibimos el número de turno
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


    const ticket = data[0];


    // ======================================
    // MOSTRAR TURNO
    // ======================================

    app.innerHTML = `

        <div class="card hero">

            <p class="muted">
                ${business.name}
            </p>

            <h2>
                🎟️ Tu turno es
            </h2>

            <div class="ticket-number">
                ${ticket.ticket_code}
            </div>

            <h3>
                ${ticket.service_name}
            </h3>

            <p>
                ⏱️ ${service.duration_minutes} minutos
            </p>

            <p>
                💰 ${money(service.price)}
            </p>

            <div class="status-box">

                <strong>
                    En espera
                </strong>

                <p>
                    Por favor espera a ser llamado.
                </p>

            </div>

            <button
                class="btn"
                onclick="renderCustomer()"
            >
                Tomar otro turno
            </button>

        </div>

    `;

}


// ==========================================
// INICIAR
// ==========================================

loadBusiness();

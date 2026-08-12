const app = document.getElementById("app");
const statusEl = document.getElementById("status");

const slug =
    new URLSearchParams(location.search).get("b")
    || "barberia-el-jefe";

let business = null;
let services = [];
let channel = null;


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

                <h2>💈 Barbería no encontrada</h2>

                <p>
                    No encontramos una barbería con este código:
                </p>

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
                "id,name,price,duration_minutes"
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

                <p>
                    ${error.message}
                </p>

            </div>
        `;

        return;
    }


    services = data || [];

    statusEl.textContent = "Conectado";

    renderCustomer();
}


// ==========================================
// MOSTRAR BARBERÍA
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
                p_service_id: serviceId
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
                    Intentar nuevamente
                </button>

            </div>

        `;

        return;
    }


    const ticket =
        data[0] || data;

    showTicket(ticket);
}


// ==========================================
// MOSTRAR TURNO
// ==========================================

async function showTicket(ticket) {

    const { data, error } =
        await client.rpc(
            "public_ticket_status",
            {
                p_ticket_id: ticket.id
            }
        );


    if (error) {

        console.error(error);

        alert(error.message);

        return;
    }


    const current =
        data[0] || data;

    renderTicket(current);

    subscribeTicket(current.id);
}


// ==========================================
// PANTALLA DEL TURNO
// ==========================================

function renderTicket(ticket) {

    const ahead =
        Number(ticket.people_ahead || 0);


    const progress =
        Math.max(
            8,
            100 - (ahead * 12)
        );


    app.innerHTML = `

        <div class="card hero">

            <p class="muted">
                Tu turno
            </p>


            <div class="big">

                ${ticket.ticket_code}

            </div>


            <h2>

                ${ticket.service_name}

            </h2>


            <p>

                <b>
                    ${ahead}
                </b>

                ${
                    ahead === 1
                    ? "persona"
                    : "personas"
                }

                delante

            </p>


            <div class="progress">

                <div
                    class="bar"
                    style="width:${progress}%"
                ></div>

            </div>


            <h2>

                ⏱️
                ${ticket.estimated_minutes}
                min aprox.

            </h2>


            <span class="badge">

                ${String(ticket.status).toUpperCase()}

            </span>

        </div>


        <div class="card">

            <p class="muted">

                Esta pantalla se actualizará
                automáticamente cuando avance
                tu turno.

            </p>


            <button
                class="btn"
                onclick="location.href='?b=${slug}'"
            >

                Tomar otro turno

            </button>

        </div>

    `;
}


// ==========================================
// ACTUALIZACIÓN EN TIEMPO REAL
// ==========================================

function subscribeTicket(ticketId) {

    if (channel) {

        client.removeChannel(channel);

    }


    channel =
        client
            .channel(
                "ticket-" + ticketId
            )

            .on(
                "postgres_changes",
                {
                    event: "*",
                    schema: "public",
                    table: "tickets",
                    filter:
                        `id=eq.${ticketId}`
                },

                async () => {

                    const { data, error } =
                        await client.rpc(
                            "public_ticket_status",
                            {
                                p_ticket_id: ticketId
                            }
                        );


                    if (!error && data) {

                        renderTicket(
                            data[0] || data
                        );

                    }

                }
            )

            .subscribe();

}


// ==========================================
// INICIAR
// ==========================================

loadBusiness();

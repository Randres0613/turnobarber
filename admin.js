```html
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">

    <title>TurnoBarber - Panel</title>

    <link rel="stylesheet" href="style.css">

    <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
</head>

<body>

    <header class="topbar">

        <div>
            <h1>💈 TurnoBarber</h1>
            <p id="businessInfo">Cargando barbería...</p>
        </div>

        <span id="connectionStatus" class="badge">
            CONECTANDO
        </span>

    </header>


    <!-- ==========================================
         RECUPERAR / CAMBIAR CONTRASEÑA
    =========================================== -->

    <section
        id="passwordRecoveryApp"
        class="card hero"
        style="max-width: 500px; margin: 30px auto; display: none;"
    >

        <h2>🔐 Crear nueva contraseña</h2>

        <p>
            Escribe una nueva contraseña para tu cuenta de TurnoBarber.
        </p>


        <form id="passwordRecoveryForm">

            <div style="margin-bottom: 15px;">

                <label for="newPassword">
                    Nueva contraseña
                </label>

                <input
                    id="newPassword"
                    type="password"
                    placeholder="Nueva contraseña"
                    autocomplete="new-password"
                    required
                    minlength="6"
                    style="width: 100%; padding: 10px; margin-top: 5px;"
                >

            </div>


            <div style="margin-bottom: 15px;">

                <label for="confirmPassword">
                    Confirmar contraseña
                </label>

                <input
                    id="confirmPassword"
                    type="password"
                    placeholder="Repite la contraseña"
                    autocomplete="new-password"
                    required
                    minlength="6"
                    style="width: 100%; padding: 10px; margin-top: 5px;"
                >

            </div>


            <button
                id="passwordRecoveryButton"
                type="submit"
                class="btn primary big"
            >
                🔐 Guardar nueva contraseña
            </button>


            <p
                id="passwordRecoveryMessage"
                style="margin-top: 15px;"
            ></p>

        </form>

    </section>


    <!-- ==========================================
         ACCESO ADMINISTRADOR
    =========================================== -->

    <section
        id="loginApp"
        class="card hero"
        style="max-width: 500px; margin: 30px auto; display: none;"
    >

        <h2>🔐 Acceso administrador</h2>

        <p>
            Inicia sesión para administrar tu barbería.
        </p>


        <form id="loginForm">

            <div style="margin-bottom: 15px;">

                <label for="loginEmail">
                    Correo electrónico
                </label>

                <input
                    id="loginEmail"
                    type="email"
                    placeholder="Correo electrónico"
                    autocomplete="email"
                    required
                    style="width: 100%; padding: 10px; margin-top: 5px;"
                >

            </div>


            <div style="margin-bottom: 15px;">

                <label for="loginPassword">
                    Contraseña
                </label>

                <input
                    id="loginPassword"
                    type="password"
                    placeholder="Contraseña"
                    autocomplete="current-password"
                    required
                    style="width: 100%; padding: 10px; margin-top: 5px;"
                >

            </div>


            <button
                id="loginButton"
                type="submit"
                class="btn primary big"
            >
                🔐 Iniciar sesión
            </button>


            <p
                id="loginMessage"
                style="margin-top: 15px;"
            ></p>

        </form>

    </section>


    <!-- ==========================================
         PANEL ADMINISTRADOR
    =========================================== -->

    <main
        id="adminApp"
        style="display: none;"
    >

        <div class="card hero">

            <h2>
                ⏳ Cargando panel...
            </h2>

            <p>
                Espera un momento.
            </p>

        </div>

    </main>


    <!-- SUPABASE -->
    <script src="supabase.js"></script>

    <!-- ADMIN -->
    <script src="admin.js"></script>


    <!-- ==========================================
         CONTROL DE RECUPERACIÓN
    =========================================== -->

    <script>

        const passwordRecoveryApp =
            document.getElementById(
                "passwordRecoveryApp"
            );

        const passwordRecoveryForm =
            document.getElementById(
                "passwordRecoveryForm"
            );

        const passwordRecoveryMessage =
            document.getElementById(
                "passwordRecoveryMessage"
            );

        const passwordRecoveryButton =
            document.getElementById(
                "passwordRecoveryButton"
            );

        const loginAppElement =
            document.getElementById(
                "loginApp"
            );

        const adminAppElement =
            document.getElementById(
                "adminApp"
            );


        function showPasswordRecovery() {

            if (passwordRecoveryApp) {
                passwordRecoveryApp.style.display =
                    "block";
            }

            if (loginAppElement) {
                loginAppElement.style.display =
                    "none";
            }

            if (adminAppElement) {
                adminAppElement.style.display =
                    "none";
            }

            const status =
                document.getElementById(
                    "connectionStatus"
                );

            if (status) {
                status.textContent =
                    "CAMBIAR CONTRASEÑA";
            }
        }


        async function updatePassword() {

            const newPassword =
                document.getElementById(
                    "newPassword"
                ).value;

            const confirmPassword =
                document.getElementById(
                    "confirmPassword"
                ).value;


            if (newPassword.length < 6) {

                passwordRecoveryMessage.textContent =
                    "❌ La contraseña debe tener mínimo 6 caracteres.";

                return;
            }


            if (
                newPassword !==
                confirmPassword
            ) {

                passwordRecoveryMessage.textContent =
                    "❌ Las contraseñas no coinciden.";

                return;
            }


            passwordRecoveryButton.disabled =
                true;

            passwordRecoveryButton.textContent =
                "🔄 Guardando...";

            passwordRecoveryMessage.textContent =
                "";


            try {

                const {
                    data,
                    error
                } =
                    await client.auth.updateUser({
                        password:
                            newPassword
                    });


                if (error) {
                    throw error;
                }


                passwordRecoveryMessage.textContent =
                    "✅ Contraseña actualizada correctamente.";


                passwordRecoveryButton.textContent =
                    "✅ Contraseña guardada";


                setTimeout(
                    async function () {

                        await client.auth.signOut();

                        window.location.href =
                            "admin.html";

                    },
                    1500
                );


            } catch (error) {

                console.error(
                    "ERROR CAMBIANDO CONTRASEÑA:",
                    error
                );


                passwordRecoveryMessage.textContent =
                    "❌ " + error.message;


                passwordRecoveryButton.disabled =
                    false;

                passwordRecoveryButton.textContent =
                    "🔐 Guardar nueva contraseña";
            }
        }


        if (passwordRecoveryForm) {

            passwordRecoveryForm.addEventListener(
                "submit",
                function (event) {

                    event.preventDefault();

                    updatePassword();

                }
            );

        }


        /*
         * Supabase utiliza el evento PASSWORD_RECOVERY
         * cuando el usuario llega mediante un enlace
         * de recuperación de contraseña.
         */

        client.auth.onAuthStateChange(
            function (
                event,
                session
            ) {

                console.log(
                    "AUTH RECOVERY:",
                    event
                );


                if (
                    event ===
                    "PASSWORD_RECOVERY"
                ) {

                    showPasswordRecovery();

                }

            }
        );


        /*
         * También detectamos el tipo recovery
         * directamente en la URL como respaldo.
         */

        if (
            window.location.hash.includes(
                "type=recovery"
            )
        ) {

            showPasswordRecovery();

        }

    </script>

</body>
</html>
```

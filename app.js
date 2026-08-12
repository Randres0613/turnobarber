const app=document.getElementById("app");
const statusEl=document.getElementById("status");
const slug=new URLSearchParams(location.search).get("b")||"barberia-el-jefe";
let business=null,services=[],channel=null;

async function load(){
  const r=await client.from("businesses").select("id,name,city,qr_slug").eq("qr_slug",slug).single();
  if(r.error){statusEl.textContent="Error";app.innerHTML=`<div class="card"><h2>No encontramos la barbería</h2><p>${r.error.message}</p></div>`;return}
  business=r.data;
  const s=await client.from("services").select("id,name,price,duration_minutes").eq("business_id",business.id).eq("active",true).order("name");
  if(s.error){app.innerHTML=`<div class="card"><h2>Error cargando servicios</h2><p>${s.error.message}</p></div>`;return}
  services=s.data||[];
  statusEl.textContent="Conectado";
  renderCustomer();
}

function money(n){return "$"+Number(n).toLocaleString("es-CO")}

function renderCustomer(){
  app.innerHTML=`
  <div class="card hero">
    <h1>💈 ${business.name}</h1>
    <p class="muted">${business.city||""}</p>
    <span class="badge">ONLINE</span>
  </div>
  <div class="card">
    <h2>Elige tu servicio</h2>
    <div class="grid">
      ${services.map(s=>`
        <div class="service">
          <h3>${s.name}</h3>
          <p>${s.duration_minutes} min · ${money(s.price)}</p>
          <button class="btn" onclick="take('${s.id}')">Tomar turno</button>
        </div>`).join("")}
    </div>
  </div>`;
}

async function take(serviceId){
  const r=await client.rpc("public_take_ticket",{p_business_id:business.id,p_service_id:serviceId});
  if(r.error){alert("No se pudo tomar el turno: "+r.error.message);return}
  showTicket(r.data[0]||r.data);
}

async function showTicket(t){
  const r=await client.rpc("public_ticket_status",{p_ticket_id:t.id});
  if(r.error){alert(r.error.message);return}
  const x=r.data[0]||r.data;
  renderTicket(x);
  subscribeTicket(x.id);
}

function renderTicket(t){
  app.innerHTML=`
  <div class="card hero">
    <p class="muted">Tu turno</p>
    <div class="big">${t.ticket_code}</div>
    <h2>${t.service_name}</h2>
    <p><b>${t.people_ahead}</b> personas delante</p>
    <div class="progress"><div class="bar" style="width:${Math.max(8,100-(t.people_ahead*12))}%"></div></div>
    <h2>⏱️ ${t.estimated_minutes} min aprox.</h2>
    <span class="badge">${t.status.toUpperCase()}</span>
  </div>
  <div class="card">
    <p class="muted">Esta pantalla se actualiza automáticamente cuando cambia tu turno.</p>
    <button class="btn" onclick="location.href='?b=${slug}'">Tomar otro turno</button>
  </div>`;
}

function subscribeTicket(id){
  if(channel)client.removeChannel(channel);
  channel=client.channel("ticket-"+id)
    .on("postgres_changes",{event:"*",schema:"public",table:"tickets",filter:`id=eq.${id}`},
      async()=>{const r=await client.rpc("public_ticket_status",{p_ticket_id:id});if(!r.error)renderTicket(r.data[0]||r.data)})
    .subscribe();
}

load();

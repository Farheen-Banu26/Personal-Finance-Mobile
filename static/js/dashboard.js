// helper to switch views
function showView(id){
  document.querySelectorAll('.view').forEach(v=> v.classList.add('hidden'));
  document.getElementById(id).classList.remove('hidden');
  document.querySelectorAll('.nav-btn').forEach(b=> b.classList.remove('active'));
  document.querySelector('.nav-btn[data-target="'+id+'"]').classList.add('active');
}

document.querySelectorAll('.nav-btn').forEach(b=>{
  b.addEventListener('click', ()=> showView(b.dataset.target));
});

// Dashboard fetching
async function fetchDashboard(){
  const res = await fetch('/dashboard_data');
  const data = await res.json();
  document.getElementById('incomeValue').textContent = '₹' + data.income;
  document.getElementById('expensesValue').textContent = '₹' + data.expenses;
  document.getElementById('savingsValue').textContent = '₹' + data.savings;
  const percent = data.goals_progress || 0;
  const bar = document.getElementById('progressBar');
  bar.style.width = percent + '%';
  document.getElementById('progressPercent').textContent = percent + '%';
  const list = document.getElementById('transactionsList');
  list.innerHTML = '';
  (data.transactions || []).forEach(t => {
    const li = document.createElement('li');
    li.innerHTML = `<div>${t.title}</div><div>${t.type==='income'?'+':'-'}₹${t.amount}</div>`;
    list.appendChild(li);
  });
  // budgets
  renderBudgets(data.budgets || []);
  // notifications from budget alerts
  const alerts = data.budget_alerts || [];
  const notifyBadge = document.getElementById('notifyBadge');
  const menu = document.getElementById('notifyMenu');
  menu.innerHTML = '';
  if(alerts.length){
    notifyBadge.textContent = alerts.length;
    alerts.forEach(a=>{
      const el = document.createElement('div');
      el.textContent = `Budget exceeded: ${a.category} (spent ₹${a.spent} / limit ₹${a.limit})`;
      menu.appendChild(el);
    });
  } else {
    notifyBadge.textContent = '0';
    const el = document.createElement('div'); el.textContent = 'No notifications'; menu.appendChild(el);
  }
}

// Streak
async function fetchStreak(){
  const res = await fetch('/get_streak');
  const s = await res.json();
  document.getElementById('streakCount').textContent = s.count || 0;
  document.getElementById('lastActive').textContent = 'Last active: ' + (s.last_active || '-');
}

document.getElementById('updateActiveBtn').addEventListener('click', async ()=>{
  const res = await fetch('/update_active', {method:'POST'});
  const s = await res.json();
  const el = document.getElementById('streakCount');
  el.style.transform = 'scale(1.2)';
  setTimeout(()=> el.style.transform = 'scale(1)', 400);
  document.getElementById('streakCount').textContent = s.count || 0;
  document.getElementById('lastActive').textContent = 'Last active: ' + (s.last_active || '-');
  fetchDashboard();
});

// Wallpaper download (simple snapshot)
document.getElementById('downloadWallpaper').addEventListener('click', ()=>{
  const canvas = document.createElement('canvas');
  const scale = 2;
  const width = 800;
  const height= 600;
  canvas.width = width*scale; canvas.height = height*scale;
  const ctx = canvas.getContext('2d');
  const g = ctx.createLinearGradient(0,0,canvas.width,canvas.height);
  g.addColorStop(0,'#ff8a00'); g.addColorStop(1,'#e52e71');
  ctx.fillStyle = g; ctx.fillRect(0,0,canvas.width,canvas.height);
  const img = document.querySelector('.mascot-img');
  try{ ctx.drawImage(img, 40*scale,40*scale,200*scale,200*scale); }catch(e){}
  ctx.fillStyle='#fff'; ctx.font=(36*scale)+'px sans-serif';
  ctx.fillText('Keep Going!', 320*scale,120*scale);
  ctx.font=(28*scale)+'px sans-serif';
  ctx.fillText('Streak: '+document.getElementById('streakCount').textContent, 320*scale,180*scale);
  ctx.fillText('Goals: '+document.getElementById('progressPercent').textContent, 320*scale,220*scale);
  const a = document.createElement('a'); a.href = canvas.toDataURL('image/png'); a.download='financial_guardian_wallpaper.png'; a.click();
});

// Transactions page logic
async function loadAllTransactions(){
  const res = await fetch('/transactions');
  const txs = await res.json();
  const ul = document.getElementById('allTransactions');
  ul.innerHTML = '';
  txs.forEach(t=>{
    const li = document.createElement('li');
    li.innerHTML = `<div><strong>${t.title}</strong> <small>${t.category}</small></div><div>${t.type==='income'?'+':'-'}₹${t.amount} <button data-id="${t.id}" class="delBtn">Delete</button></div>`;
    ul.appendChild(li);
  });
  document.querySelectorAll('.delBtn').forEach(b=> b.addEventListener('click', async ()=>{
    const id = b.dataset.id;
    await fetch('/delete_transaction', {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({id})});
    loadAllTransactions(); fetchDashboard();
  }));
}

document.getElementById('addTxForm').addEventListener('submit', async (e)=>{
  e.preventDefault();
  const data = {
    title: document.getElementById('txTitle').value,
    type: document.getElementById('txType').value,
    amount: document.getElementById('txAmount').value,
    date: document.getElementById('txDate').value || undefined,
    category: document.getElementById('txCategory').value || 'General'
  };
  await fetch('/add_transaction', {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(data)});
  e.target.reset();
  loadAllTransactions(); fetchDashboard();
});

// Budgets logic
function renderBudgets(budgets){
  const ul = document.getElementById('budgetsList');
  ul.innerHTML = '';
  budgets.forEach(b=>{
    const li = document.createElement('li');
    li.innerHTML = `<div>${b.category}</div><div>Limit: ₹${b.limit} <button data-id="${b.id}" class="delBudget">Delete</button></div>`;
    ul.appendChild(li);
  });
  document.querySelectorAll('.delBudget').forEach(btn=> btn.addEventListener('click', async ()=>{
    await fetch('/delete_budget', {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({id: btn.dataset.id})});
    loadBudgets();
    fetchDashboard();
  }));
}

async function loadBudgets(){
  const res = await fetch('/budgets');
  const budgets = await res.json();
  renderBudgets(budgets);
}

document.getElementById('addBudgetForm').addEventListener('submit', async (e)=>{
  e.preventDefault();
  const data = {
    category: document.getElementById('budgetCategory').value,
    limit: document.getElementById('budgetLimit').value
  };
  await fetch('/budgets', {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(data)});
  e.target.reset();
  loadBudgets(); fetchDashboard();
});

// Profile logic
async function loadProfile(){
  const res = await fetch('/profile');
  const p = await res.json();
  document.getElementById('profileName').value = p.name || '';
  document.getElementById('profileSavings').value = p.savings || 0;
  document.getElementById('appTitle').textContent = p.name ? p.name + " - Financial Guardian" : 'Financial Guardian';
}

document.getElementById('profileForm').addEventListener('submit', async (e)=>{
  e.preventDefault();
  const data = { name: document.getElementById('profileName').value, savings: document.getElementById('profileSavings').value };
  await fetch('/profile', {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(data)});
  loadProfile(); fetchDashboard();
});

// notifications UI toggle
document.getElementById('notifyBtn').addEventListener('click', ()=>{
  document.getElementById('notifyMenu').classList.toggle('hidden');
});

// initial load
showView('view-dashboard');
fetchDashboard();
fetchStreak();
loadAllTransactions();
loadBudgets();
loadProfile();
setInterval(fetchDashboard, 30000);

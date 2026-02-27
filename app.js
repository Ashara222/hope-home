let currentUser = "";
let currentRoom = "";
let allTasks = [];

const heroColors = { 
    Sarah: 'var(--sarah)', 
    Shawn: 'var(--shawn)', 
    Summer: 'var(--summer)', 
    Kirsten: 'var(--kirsten)', 
    Hailey: 'var(--hailey)' 
};

const taskLibrary = {
    "Kitchen": ["Dishes", "Trash", "Counters", "Sink", "Sweep", "Stove", "Mop", "Fridge", "Oven", "Microwave", "Pantry", "Stainless Steel"],
    "Living Room": ["Tidy", "Vacuum", "Dusting", "Mop", "Electronics", "Fan", "Windows", "Baseboards"],
    "Entrance": ["Sweep/Vacuum", "Mop", "Dusting", "Windows", "Tidy Shoes"],
    "Computer Area": ["Wipe Screen", "Dust Keyboard", "Organize Cords", "Clean Chair"],
    "Summer Bedroom": ["Make Bed", "Laundry", "Vacuum", "Tidy Desk"],
    "Summer Bath": ["Clean Sink", "Clean Toilet", "Mirrors", "Towels"],
    "Master Bedroom": ["Linen", "Vacuum", "Dusting", "Tidy"],
    "Master Bath": ["Shower", "Toilet", "Sink", "Mirrors"],
    "Girls Bath": ["Clean Tub", "Toilet", "Sink", "Towels"]
};

// 1. IDENTITY
function selectUser(name, emoji) {
    currentUser = name;
    document.getElementById('active-user-display').innerText = name + " " + emoji;
    document.getElementById('login-overlay').style.display = 'none';
    document.getElementById('app').style.display = 'block';
}
function logout() { document.getElementById('login-overlay').style.display = 'flex'; }

// 2. SYNC
db.ref('tasks').on('value', (snapshot) => {
    const data = snapshot.val();
    allTasks = data ? Object.values(data) : [];
    renderTasks();
});

// 3. NAV
function openRoom(roomName) {
    currentRoom = roomName;
    document.getElementById('home-view').style.display = 'none';
    document.getElementById('stats-view').style.display = 'none';
    document.getElementById('history-view').style.display = 'none';
    document.getElementById('room-view').style.display = 'block';
    document.getElementById('current-room-name').innerText = roomName;
    renderTasks();
}
function showHome() {
    document.getElementById('home-view').style.display = 'block';
    document.getElementById('room-view').style.display = 'none';
    document.getElementById('stats-view').style.display = 'none';
    document.getElementById('history-view').style.display = 'none';
}
function showStats() {
    document.getElementById('home-view').style.display = 'none';
    document.getElementById('history-view').style.display = 'none';
    document.getElementById('stats-view').style.display = 'block';
    renderStats();
}

// 4. MODAL & MONTH LOGIC
function updateFreqUI() {
    const type = document.getElementById('freq-type').value;
    document.getElementById('ui-num').style.display = (type === 'days' || type === 'monthly') ? 'block' : 'none';
    document.getElementById('ui-weekly').style.display = (type === 'weekly') ? 'block' : 'none';
}

function saveNewTask() {
    const id = document.getElementById('edit-task-id').value || Date.now();
    const name = document.getElementById('new-task-name').value;
    const type = document.getElementById('freq-type').value;
    const num = parseInt(document.getElementById('freq-num').value) || 0;
    const startOverdue = document.getElementById('start-overdue').checked;
    
    let finalDays = 0;
    if (type === 'days') finalDays = num;
    if (type === 'weekly') finalDays = "W" + document.getElementById('freq-day').value;
    if (type === 'monthly') finalDays = num * 30; 

    if (name) {
        let compDate = new Date();
        if (startOverdue) {
            let offset = (typeof finalDays === 'number' && finalDays > 0) ? finalDays * 1.5 : 14;
            compDate.setDate(compDate.getDate() - offset);
        }
        db.ref('tasks/' + id).update({
            id: id, room: currentRoom, name: name, freq: finalDays, type: type,
            lastDone: compDate.toISOString(), lastUser: "No one", snoozedUntil: ""
        });
        closeModal();
    }
}

// 5. RENDER & GRADIENTS
function renderTasks() {
    const redList = document.getElementById('task-list-red');
    const greenList = document.getElementById('task-list-green');
    if (!redList) return;
    redList.innerHTML = ""; greenList.innerHTML = "";

    const roomTasks = allTasks.filter(t => t.room === currentRoom);
    roomTasks.sort((a,b) => calculateUrgency(b) - calculateUrgency(a));

    roomTasks.forEach(task => {
        const urgency = calculateUrgency(task);
        const isSnoozed = task.snoozedUntil && new Date(task.snoozedUntil) > new Date();
        const color = getHeatColor(urgency);
        
        const html = `
            <div class="task-card bubble-shadow ${isSnoozed ? 'snoozed' : ''}">
                <span class="edit-icon" onclick="editTask('${task.id}')" style="position:absolute; top:12px; right:12px; cursor:pointer; opacity:0.3;">✏️</span>
                <h3>${task.name}</h3>
                <div class="mini-bar"><div class="mini-fill" style="width:${Math.min(urgency * 100, 100)}%; background-color:${color}; height:100%;"></div></div>
                <div class="card-actions">
                    <button class="btn-task done-btn" onclick="completeTask('${task.id}')">DONE 🎉</button>
                    ${!isSnoozed ? `<button class="btn-task snooze-btn" onclick="snoozeTask('${task.id}')">💤</button>` : ''}
                </div>
            </div>`;
        if (urgency >= 1 && !isSnoozed) redList.innerHTML += html;
        else greenList.innerHTML += html;
    });
}

function calculateUrgency(task) {
    if (task.type === 'anytime') return 0;
    const diff = Math.abs(new Date() - new Date(task.lastDone)) / (1000 * 60 * 60 * 24);
    if (task.type === 'weekly') return (new Date().getDay() == task.freq.substring(1)) ? 1.1 : 0.1;
    let baseFreq = (typeof task.freq === 'number' && task.freq > 0) ? task.freq : 7;
    return diff / baseFreq;
}

function getHeatColor(r) {
    if (r < 0.6) return "#A8E6CF"; 
    if (r < 1.0) return "#FFD966"; 
    if (r < 2.0) return "#FFADAD"; 
    return "#FF5C5C"; 
}

// 6. GLOBAL QUEST (Removes card on click to prevent double-click)
function searchGlobalQuest() {
    const keyword = document.getElementById('global-keyword').value.toLowerCase();
    const resultsArea = document.getElementById('global-search-results');
    resultsArea.innerHTML = "";
    if (!keyword) return;

    const matches = allTasks.filter(t => t.name.toLowerCase().includes(keyword));
    matches.forEach(task => {
        const cardId = `global-card-${task.id}`;
        resultsArea.innerHTML += `
            <div id="${cardId}" class="task-card bubble-shadow" style="background:#f9fcff; border:3px solid var(--secondary); max-width:300px; margin: 10px auto; padding: 20px;">
                <h3 style="color:#262424 !important; margin-bottom:15px;">${task.name} (${task.room})</h3>
                <button class="btn-task done-btn" style="color:#fff !important; background: var(--secondary); font-weight:900; border:none; width:100%; padding:12px; border-radius:12px;" 
                onclick="completeTask('${task.id}'); document.getElementById('${cardId}').remove();">FINISH QUEST 🎉</button>
            </div>`;
    });
}

// 7. STATS & LOG DELETE (Auto-refresh enabled)
function renderStats() {
    const board = document.getElementById('leaderboard');
    const activityLog = document.getElementById('activity-log');
    
    const totals = { Sarah: 0, Shawn: 0, Summer: 0, Kirsten: 0, Hailey: 0 };
    let fullHistory = [];
    const limit30 = new Date(); limit30.setDate(limit30.getDate() - 30);

    allTasks.forEach(task => {
        if (task.history) {
            Object.entries(task.history).forEach(([entryKey, entry]) => {
                const d = new Date(entry.date);
                if (d > limit30) {
                    if (totals[entry.user] !== undefined) totals[entry.user]++;
                    fullHistory.push({ user: entry.user, task: task.name, room: task.room, date: d, taskId: task.id, entryKey: entryKey });
                }
            });
        }
    });

    board.innerHTML = Object.keys(totals).map(name => `
        <div class="leader-row bubble-shadow" style="background:${heroColors[name]}" onclick="showUserHistory('${name}')">
            <span>${name}</span>
            <span>${totals[name]} Quests</span>
        </div>`).join("");

    fullHistory.sort((a,b) => b.date - a.date);
    activityLog.innerHTML = fullHistory.slice(0, 25).map(h => `
        <div class="log-item-v2">
            <div class="log-info"><b>${h.task}</b><small>${h.room}</small></div>
            <div style="display:flex; align-items:center;">
                <div style="text-align:right"><b style="color:${heroColors[h.user]}">${h.user}</b><br><small style="font-size:0.7rem;">${h.date.toLocaleDateString()}</small></div>
                <button class="btn-delete-log" onclick="deleteLogEntry('${h.taskId}', '${h.entryKey}', null)">X</button>
            </div>
        </div>`).join("");
}

function showUserHistory(userName) {
    document.getElementById('stats-view').style.display = 'none'; 
    document.getElementById('history-view').style.display = 'block'; 
    const detailTitle = document.getElementById('detail-title');
    const detailLog = document.getElementById('user-history-log');
    detailTitle.innerText = `${userName}'s Magic History ✨`;
    
    let history90 = [];
    const limit90 = new Date(); limit90.setDate(limit90.getDate() - 90);

    allTasks.forEach(task => {
        if (task.history) {
            Object.entries(task.history).forEach(([entryKey, entry]) => {
                const d = new Date(entry.date);
                if (entry.user === userName && d > limit90) {
                    history90.push({ user: entry.user, task: task.name, room: task.room, date: d, taskId: task.id, entryKey: entryKey });
                }
            });
        }
    });

    history90.sort((a,b) => b.date - a.date);

    if(history90.length === 0) {
        detailLog.innerHTML = `<div class="history-bubble bubble-shadow" style="justify-content: center;"><b>No magic recorded in 90 days!</b></div>`;
    } else {
        detailLog.innerHTML = history90.map(h => `
            <div class="history-bubble bubble-shadow">
                <span><b>${h.task}</b> (${h.room})</span>
                <div style="display:flex; align-items:center;">
                    <small>${h.date.toLocaleDateString()}</small>
                    <button class="btn-delete-log" onclick="deleteLogEntry('${h.taskId}', '${h.entryKey}', '${h.user}')">X</button>
                </div>
            </div>`).join("");
    }
    window.scrollTo(0,0);
}

function deleteLogEntry(taskId, entryKey, userName) {
    if (confirm("Delete this completion? This will lower the quest score.")) {
        db.ref(`tasks/${taskId}/history/${entryKey}`).remove().then(() => {
            if (userName) {
                showUserHistory(userName);
            }
            renderStats();
        });
    }
}

function closeUserDetail() {
    document.getElementById('history-view').style.display = 'none';
    document.getElementById('stats-view').style.display = 'block';
}

// 8. HELPERS
function completeTask(id) {
    const now = new Date().toISOString();
    db.ref('tasks/' + id + '/history').push({ user: currentUser, date: now });
    db.ref('tasks/' + id).update({ lastDone: now, lastUser: currentUser, snoozedUntil: "" });
}
function snoozeTask(id) {
    const tom = new Date(); tom.setDate(tom.getDate() + 1);
    db.ref('tasks/' + id).update({ snoozedUntil: tom.toISOString() });
}
function editTask(taskId) {
    const t = allTasks.find(x => x.id == taskId);
    document.getElementById('edit-task-id').value = t.id;
    document.getElementById('new-task-name').value = t.name;
    document.getElementById('modal-title').innerText = "Edit Mission";
    openAddModal();
}
function openAddModal() { 
    document.getElementById('task-modal').style.display = 'flex'; 
    updateFreqUI();
}
function closeModal() { document.getElementById('task-modal').style.display = 'none'; document.getElementById('edit-task-id').value = ""; document.getElementById('new-task-name').value = ""; document.getElementById('modal-title').innerText = "Mission Control"; }
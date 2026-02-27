let currentUser = "";
let currentRoom = "";
let allTasks = [];

const taskLibrary = {
    "Kitchen": ["Dishes", "Trash", "Counters", "Sink", "Sweep", "Stove", "Mop", "Fridge", "Pantry", "Oven", "Walls", "Baseboards"],
    "Living Room": ["Tidy", "Vacuum", "Dusting", "Mop", "Electronics", "Fan", "Windows", "Baseboards", "Walls"],
    "Bedrooms": ["Linen", "Laundry", "Vacuum", "Dusting", "Under Bed", "Fan", "Closet", "Baseboards"],
    "Bathrooms": ["Toilet", "Sink", "Shower", "Mirrors", "Towels", "Trash", "Baseboards"],
    "Laundry Room": ["Washer", "Dryer", "Trash", "Mop"],
    "Dining Area": ["Table", "Chairs", "Vacuum", "Mop"],
    "Entrance": ["Vacuum", "Mop", "Dusting", "Windows"]
};

// 1. IDENTITY
function selectUser(name, emoji) {
    currentUser = name;
    document.getElementById('active-user-display').innerText = name + " " + emoji;
    document.getElementById('login-overlay').style.display = 'none';
    document.getElementById('app').style.display = 'block';
}

function logout() {
    document.getElementById('login-overlay').style.display = 'flex';
    document.getElementById('app').style.display = 'none';
}

// 2. CLOUD SYNC
db.ref('tasks').on('value', (snapshot) => {
    const data = snapshot.val();
    allTasks = data ? Object.values(data) : [];
    renderTasks();
});

// 3. NAVIGATION
function openRoom(roomName) {
    currentRoom = roomName;
    document.getElementById('home-view').style.display = 'none';
    document.getElementById('stats-view').style.display = 'none';
    document.getElementById('room-view').style.display = 'block';
    document.getElementById('current-room-name').innerText = roomName;
    renderTasks();
}

function showHome() {
    document.getElementById('home-view').style.display = 'block';
    document.getElementById('room-view').style.display = 'none';
    document.getElementById('stats-view').style.display = 'none';
}

function showStats() {
    document.getElementById('home-view').style.display = 'none';
    document.getElementById('stats-view').style.display = 'block';
    renderStats();
}

// 4. MODAL LOGIC
function toggleFreqInput() {
    const type = document.getElementById('freq-type').value;
    const container = document.getElementById('freq-number-container');
    container.style.display = type === 'anytime' ? 'none' : 'block';
}

function openAddModal() {
    const modal = document.getElementById('task-modal');
    const wheel = document.getElementById('library-wheel');
    wheel.innerHTML = "";
    
    taskLibrary[currentRoom].forEach(taskName => {
        const card = document.createElement('div');
        card.className = "wheel-card";
        card.innerHTML = `<span>${taskName}</span>`;
        card.onclick = () => { 
            document.getElementById('new-task-name').value = taskName;
            document.querySelectorAll('.wheel-card').forEach(c => c.style.border = "none");
            card.style.border = "4px solid #FF6B6B";
        };
        wheel.appendChild(card);
    });
    modal.style.display = 'flex';
}

function scrollWheel(direction) {
    const container = document.getElementById('library-wheel');
    container.scrollBy({ left: direction * 140, behavior: 'smooth' });
}

function closeModal() { document.getElementById('task-modal').style.display = 'none'; }

function saveNewTask() {
    const name = document.getElementById('new-task-name').value;
    const type = document.getElementById('freq-type').value;
    const num = parseInt(document.getElementById('new-task-freq').value) || 0;
    
    let finalDays = 0;
    if (type === 'days') finalDays = num;
    if (type === 'weeks') finalDays = num * 7;
    if (type === 'months') finalDays = num * 30;

    const startOverdue = document.getElementById('start-overdue').checked;
    
    if (name) {
        const taskId = Date.now();
        let compDate = new Date();
        if (startOverdue && finalDays > 0) compDate.setDate(compDate.getDate() - (finalDays + 1));

        const newTask = {
            id: taskId, room: currentRoom, name: name, freq: finalDays,
            isAnytime: type === 'anytime', lastDone: compDate.toISOString(), lastUser: "No one"
        };
        db.ref('tasks/' + taskId).set(newTask);
        closeModal();
        
        document.getElementById('new-task-name').value = "";
        document.getElementById('new-task-freq').value = "";
        document.getElementById('freq-type').value = "anytime";
        toggleFreqInput();
    }
}

// 5. RENDERING & AUTO-SORTING
function renderTasks() {
    const list = document.getElementById('task-list');
    if (!list) return;
    list.innerHTML = "";

    // Step 1: Filter tasks for the current room
    let roomTasks = allTasks.filter(t => t.room === currentRoom);

    // Step 2: AUTO-SORT logic
    // Sorts by urgency (highest urgency at top)
    // Anytime tasks (urgency 0) stay at the bottom
    roomTasks.sort((a, b) => {
        const urgencyA = calculateUrgency(a.lastDone, a.freq);
        const urgencyB = calculateUrgency(b.lastDone, b.freq);
        
        // Anytime tasks always sink
        if (a.isAnytime && !b.isAnytime) return 1;
        if (!a.isAnytime && b.isAnytime) return -1;
        
        return urgencyB - urgencyA; // Sort high urgency to the top
    });

    // Step 3: Draw the sorted cards
    roomTasks.forEach(task => {
        const urgency = calculateUrgency(task.lastDone, task.freq);
        const color = getBarColor(urgency);
        list.innerHTML += `
            <div class="task-card bubble-shadow">
                <button class="btn-delete" onclick="deleteTask('${task.id}')">❌</button>
                <h3>${task.name}</h3>
                ${!task.isAnytime ? `<div class="progress-bar-container"><div class="progress-fill" style="width:${Math.min(urgency * 100, 100)}%; background-color:${color}"></div></div>` : `<div style="margin:10px 0; color:#4ECDC4; font-weight:bold;">✨ Anytime Bonus!</div>`}
                <p>Last: ${task.lastUser}</p>
                <button class="btn-primary" onclick="completeTask('${task.id}')">DONE! 🎉</button>
            </div>`;
    });
}

function renderStats() {
    const board = document.getElementById('leaderboard');
    const activityLog = document.getElementById('activity-log');
    const totals = { Sarah: 0, Shawn: 0, Summer: 0, Kirsten: 0, Hailey: 0 };
    let fullHistory = [];
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    allTasks.forEach(task => {
        if (task.history) {
            Object.values(task.history).forEach(entry => {
                const entryDate = new Date(entry.date);
                if (entryDate > thirtyDaysAgo) {
                    if (totals[entry.user] !== undefined) totals[entry.user]++;
                    fullHistory.push({ user: entry.user, task: task.name, room: task.room, date: entryDate });
                }
            });
        }
    });

    board.innerHTML = Object.keys(totals).map(name => `
        <div class="stat-row"><span>${name}</span><strong>${totals[name]}</strong></div>
    `).join("");

    fullHistory.sort((a, b) => b.date - a.date);
    activityLog.innerHTML = fullHistory.map(h => `
        <div class="log-item"><b>${h.user}</b>: ${h.task} (${h.room})<br><small>${h.date.toLocaleDateString()} at ${h.date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</small></div>
    `).join("");
}

// 6. ACTION
function completeTask(taskId) {
    const now = new Date().toISOString();
    db.ref('tasks/' + taskId + '/history').push({ user: currentUser, date: now });
    db.ref('tasks/' + taskId).update({ lastDone: now, lastUser: currentUser });
}

function completeGlobalQuest() {
    const keyword = document.getElementById('global-keyword').value;
    if (!keyword) return;
    allTasks.forEach(task => {
        if (task.name.toLowerCase().includes(keyword.toLowerCase())) completeTask(task.id);
    });
    document.getElementById('global-keyword').value = "";
    alert("Global mission successful! 🚀");
}

function calculateUrgency(lastDone, freq) {
    if (!freq || freq === 0) return 0;
    const diff = Math.abs(new Date() - new Date(lastDone));
    return (diff / (1000 * 60 * 60 * 24)) / freq;
}
function getBarColor(r) { return r < 0.6 ? "#A8E6CF" : (r < 1.0 ? "#FFE66D" : "#FF8B94"); }
function deleteTask(id) { if (confirm("Discard?")) db.ref('tasks/' + id).remove(); }
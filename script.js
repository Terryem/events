let rawEventsData = []; // Store original fetched data
let eventsData = [];    // Store processed/expanded calendar events

// Start date set to August 30, 2026
let currentDate = new Date("2026-08-30T00:00:00");
let currentView = 'month';
let countdownInterval = null;

const gridEl = document.getElementById('calendarGrid');
const monthYearDisplay = document.getElementById('monthYearDisplay');
const modal = document.getElementById('eventModal');
const formatFilter = document.getElementById('formatFilter');

// Helper to parse time strings like "10:00 AM" into 24-hr integers (0-23)
function parseHour(timeStr) {
    if (!timeStr) return 9;
    const parts = timeStr.trim().split(' ');
    if (parts.length < 2) return 9;
    
    const timePart = parts[0];
    const modifier = parts[1].toUpperCase();
    
    let [hours] = timePart.split(':').map(Number);
    
    if (modifier === 'PM' && hours < 12) hours += 12;
    if (modifier === 'AM' && hours === 12) hours = 0;
    return hours;
}

// Helper to expand simplified/recurring JSON rules into full calendar event objects
function expandEvents(rawEvents) {
    const expanded = [];
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const totalDaysInMonth = new Date(year, month + 1, 0).getDate();

    rawEvents.forEach(ev => {
        if (ev.date) {
            expanded.push(ev);
        } else if (ev.day) {
            const formattedMonth = String(month + 1).padStart(2, '0');
            const formattedDay = String(ev.day).padStart(2, '0');
            expanded.push({
                ...ev,
                date: `${year}-${formattedMonth}-${formattedDay}`
            });
        } else if (ev.recurring) {
            const targetDayName = ev.recurring.toLowerCase();
            const daysMap = { sunday: 0, monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6 };
            const targetDayIndex = daysMap[targetDayName];

            if (targetDayIndex !== undefined) {
                for (let d = 1; d <= totalDaysInMonth; d++) {
                    const checkDate = new Date(year, month, d);
                    if (checkDate.getDay() === targetDayIndex) {
                        const formattedMonth = String(month + 1).padStart(2, '0');
                        const formattedDay = String(d).padStart(2, '0');
                        expanded.push({
                            ...ev,
                            id: `${ev.id}-${d}`,
                            date: `${year}-${formattedMonth}-${formattedDay}`
                        });
                    }
                }
            }
        }
    });

    return expanded;
}

// Fetch the external JSON file or LocalStorage data before initializing
async function loadEventsAndInit() {
    try {
        const savedData = localStorage.getItem('calendarEvents');
        if (savedData) {
            rawEventsData = JSON.parse(savedData);
        } else {
            const response = await fetch('events.json');
            if (!response.ok) throw new Error('Failed to load events.json');
            rawEventsData = await response.json();
            localStorage.setItem('calendarEvents', JSON.stringify(rawEventsData));
        }
        
        eventsData = expandEvents(rawEventsData);
    } catch (error) {
        console.error('Error loading JSON data:', error);
        rawEventsData = [];
        eventsData = [];
    }

    initCalendar();
}

function initCalendar() {
    renderHeader();
    renderGrid();
    renderUpcoming();
    
    formatFilter.addEventListener('change', () => {
        renderGrid();
    });
    
    document.getElementById('printBtn').addEventListener('click', () => window.print());
    document.getElementById('closeModal').addEventListener('click', () => modal.close());
    
    document.querySelectorAll('.view-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('.view-btn').forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            currentView = e.target.dataset.view;
            renderGrid();
            renderHeader();
        });
    });

    document.getElementById('prevBtn').addEventListener('click', () => shiftDate(-1));
    document.getElementById('nextBtn').addEventListener('click', () => shiftDate(1));
    document.getElementById('todayBtn').addEventListener('click', () => {
        currentDate = new Date();
        eventsData = expandEvents(rawEventsData);
        renderHeader();
        renderGrid();
    });
}

function shiftDate(dir) {
    if (currentView === 'month') {
        currentDate.setMonth(currentDate.getMonth() + dir);
    } else if (currentView === 'week') {
        currentDate.setDate(currentDate.getDate() + (dir * 7));
    } else {
        currentDate.setDate(currentDate.getDate() + dir);
    }
    eventsData = expandEvents(rawEventsData); // Re-calculate recurring events for the new month/week
    renderHeader();
    renderGrid();
}

function renderHeader() {
    const options = { month: 'long', year: 'numeric' };
    
    if (currentView === 'week') {
        const curr = new Date(currentDate);
        const firstDayOfWeek = new Date(curr.setDate(curr.getDate() - curr.getDay()));
        const lastDayOfWeek = new Date(curr.setDate(firstDayOfWeek.getDate() + 6));
        
        const startStr = firstDayOfWeek.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        const endStr = lastDayOfWeek.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
        monthYearDisplay.textContent = `${startStr} - ${endStr}`;
    } else if (currentView === 'day') {
        monthYearDisplay.textContent = currentDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
    } else {
        monthYearDisplay.textContent = currentDate.toLocaleDateString('en-US', options);
    }
}

function renderGrid() {
    gridEl.innerHTML = '';
    const filterValue = formatFilter.value;
    
    const filteredEvents = eventsData.filter(ev => {
        if (filterValue === 'all') return true;
        return ev.type === filterValue;
    });

    // 1. MONTH VIEW
    if (currentView === 'month') {
        gridEl.className = "calendar-grid month-view";
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth();
        
        const firstDayIndex = new Date(year, month, 1).getDay();
        const totalDays = new Date(year, month + 1, 0).getDate();

        for (let i = 0; i < firstDayIndex; i++) {
            const emptyCell = document.createElement('div');
            emptyCell.className = "day-cell empty";
            gridEl.appendChild(emptyCell);
        }

        for (let day = 1; day <= totalDays; day++) {
            const cell = document.createElement('div');
            cell.className = "day-cell";
            const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            
            cell.innerHTML = `<strong>${day}</strong>`;
            
            const eventContainer = document.createElement('div');
            eventContainer.className = "cell-events-list";
            
            const dayEvents = filteredEvents
                .filter(ev => ev.date === dateStr)
                .sort((a, b) => new Date(`${a.date} ${a.time}`) - new Date(`${b.date} ${b.time}`));

            dayEvents.forEach(ev => {
                const eventCard = document.createElement('div');
                eventCard.className = `event-card ${ev.type}`;
                eventCard.innerHTML = `<span class="event-time">${ev.time}</span> <span class="event-title">${ev.title}</span>`;
                
                eventCard.addEventListener('click', (e) => {
                    e.stopPropagation();
                    openModal(ev);
                });
                eventContainer.appendChild(eventCard);
            });

            cell.appendChild(eventContainer);
            gridEl.appendChild(cell);
        }
    } 
    // 2. WEEK VIEW
    else if (currentView === 'week') {
        gridEl.className = "calendar-grid week-view-slots";
        const curr = new Date(currentDate);
        const firstDayOfWeek = curr.getDate() - curr.getDay();

        for (let i = 0; i < 7; i++) {
            const dayDate = new Date(new Date(curr).setDate(firstDayOfWeek + i));
            const cell = document.createElement('div');
            cell.className = "day-cell week-column";

            const year = dayDate.getFullYear();
            const month = String(dayDate.getMonth() + 1).padStart(2, '0');
            const dayNum = String(dayDate.getDate()).padStart(2, '0');
            const dateStr = `${year}-${month}-${dayNum}`;

            const options = { weekday: 'short', month: 'numeric', day: 'numeric' };
            cell.innerHTML = `<div class="column-header"><strong>${dayDate.toLocaleDateString('en-US', options)}</strong></div>`;

            const slotsWrapper = document.createElement('div');
            slotsWrapper.className = "hourly-slots-container";

            const dayEvents = filteredEvents
                .filter(ev => ev.date === dateStr)
                .sort((a, b) => new Date(`${a.date} ${a.time}`) - new Date(`${b.date} ${b.time}`));

            if (dayEvents.length === 0) {
                const emptyMsg = document.createElement('div');
                emptyMsg.style.padding = "10px";
                emptyMsg.style.color = "#aaa";
                emptyMsg.style.fontSize = "0.75rem";
                emptyMsg.textContent = "No events";
                slotsWrapper.appendChild(emptyMsg);
            } else {
                dayEvents.forEach(ev => {
                    const slotEvent = document.createElement('div');
                    slotEvent.className = `event-card ${ev.type}`;
                    slotEvent.style.marginBottom = "6px";
                    slotEvent.innerHTML = `<span class="event-time">${ev.time}</span><strong>${ev.title}</strong>`;
                    slotEvent.addEventListener('click', (e) => {
                        e.stopPropagation();
                        openModal(ev);
                    });
                    slotsWrapper.appendChild(slotEvent);
                });
            }

            cell.appendChild(slotsWrapper);
            gridEl.appendChild(cell);
        }
    }
    // 3. DAY VIEW
    else if (currentView === 'day') {
        gridEl.className = "calendar-grid day-view-slots";
        
        const year = currentDate.getFullYear();
        const month = String(currentDate.getMonth() + 1).padStart(2, '0');
        const dayNum = String(currentDate.getDate()).padStart(2, '0');
        const dateStr = `${year}-${month}-${dayNum}`;

        const dayWrapper = document.createElement('div');
        dayWrapper.className = "single-day-schedule";
        
        dayWrapper.innerHTML = `<h3>Schedule for ${currentDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}</h3>`;

        const dayEvents = filteredEvents
            .filter(ev => ev.date === dateStr)
            .sort((a, b) => new Date(`${a.date} ${a.time}`) - new Date(`${b.date} ${b.time}`));

        if (dayEvents.length === 0) {
            const p = document.createElement('p');
            p.textContent = "No meetings scheduled for this day.";
            p.style.color = "#666";
            dayWrapper.appendChild(p);
        } else {
            dayEvents.forEach(ev => {
                const row = document.createElement('div');
                row.className = "time-row";
                
                const label = document.createElement('div');
                label.className = "time-label";
                label.textContent = ev.time;

                const slotContent = document.createElement('div');
                slotContent.className = "time-slot-content";

                const slotEvent = document.createElement('div');
                slotEvent.className = `event-card ${ev.type} horizontal`;
                slotEvent.innerHTML = `<span><strong>${ev.title}</strong> - ${ev.description} <em>(${ev.type})</em></span>`;
                slotEvent.addEventListener('click', () => openModal(ev));
                
                slotContent.appendChild(slotEvent);
                row.appendChild(label);
                row.appendChild(slotContent);
                dayWrapper.appendChild(row);
            });
        }

        gridEl.appendChild(dayWrapper);
    }
}

function renderUpcoming() {
    const listEl = document.getElementById('upcomingList');
    listEl.innerHTML = '';

    const now = new Date();
    const parsedEvents = eventsData.map(ev => {
        const eventDateTime = new Date(`${ev.date} ${ev.time}`);
        return { ...ev, dateTime: eventDateTime };
    });

    const futureEvents = parsedEvents
        .filter(ev => ev.dateTime >= now)
        .sort((a, b) => a.dateTime - b.dateTime);

    let countdownContainer = document.getElementById('countdownContainer');
    if (!countdownContainer) {
        countdownContainer = document.createElement('div');
        countdownContainer.id = 'countdownContainer';
        listEl.parentNode.insertBefore(countdownContainer, listEl);
    }

    if (countdownInterval) clearInterval(countdownInterval);

    if (futureEvents.length > 0) {
        const nextEvent = futureEvents[0];
        
        function updateTimer() {
            const currentTime = new Date();
            const diff = nextEvent.dateTime - currentTime;

            if (diff <= 0) {
                countdownContainer.innerHTML = `<p><strong>Next Event:</strong> Started!</p>`;
                clearInterval(countdownInterval);
                return;
            }

            const days = Math.floor(diff / (1000 * 60 * 60 * 24));
            const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
            const minutes = Math.floor((diff / 1000 / 60) % 60);
            const seconds = Math.floor((diff / 1000) % 60);

            countdownContainer.innerHTML = `
                <div class="countdown-box">
                    <h4>Next: ${nextEvent.title}</h4>
                    <p>${days}d ${hours}h ${minutes}m ${seconds}s remaining</p>
                </div>
            `;
        }
        
        updateTimer();
        countdownInterval = setInterval(updateTimer, 1000);
    } else {
        countdownContainer.innerHTML = `<p>No upcoming meetings.</p>`;
    }

    const heading = document.createElement('h4');
    heading.textContent = "Next Future Events";
    listEl.appendChild(heading);

    futureEvents.slice(0, 10).forEach(ev => {
        const li = document.createElement('li');
        li.innerHTML = `<strong>${ev.date}</strong> - ${ev.title} <em>(${ev.type})</em>`;
        li.style.marginBottom = "8px";
        li.style.cursor = "pointer";
        li.addEventListener('click', () => openModal(ev));
        listEl.appendChild(li);
    });
}

function openModal(ev) {
    document.getElementById('modalTitle').textContent = ev.title;
    document.getElementById('modalTime').textContent = `${ev.date} at ${ev.time}`;
    document.getElementById('modalType').textContent = ev.type.toUpperCase();
    document.getElementById('modalDesc').textContent = ev.description;
    modal.showModal();
}

// Admin Panel Logic
const adminModal = document.getElementById('adminModal');
const adminToggleBtn = document.getElementById('toggleAdminBtn');
if (adminToggleBtn) {
    adminToggleBtn.addEventListener('click', () => {
        renderAdminList();
        adminModal.showModal();
    });
}

const closeAdminBtn = document.getElementById('closeAdminBtn');
if (closeAdminBtn) {
    closeAdminBtn.addEventListener('click', () => adminModal.close());
}

const addEventForm = document.getElementById('addEventForm');
if (addEventForm) {
    addEventForm.addEventListener('submit', (e) => {
        e.preventDefault();
        
        const newEvent = {
            id: Date.now(),
            title: document.getElementById('adminTitle').value,
            date: document.getElementById('adminDate').value,
            time: document.getElementById('adminTime').value,
            type: document.getElementById('adminType').value,
            description: document.getElementById('adminDesc').value
        };

        rawEventsData.push(newEvent);
        localStorage.setItem('calendarEvents', JSON.stringify(rawEventsData));

        eventsData = expandEvents(rawEventsData);
        renderGrid();
        renderUpcoming();
        renderAdminList();

        e.target.reset();
        alert('Event added successfully!');
    });
}

function renderAdminList() {
    const adminListEl = document.getElementById('adminEventList');
    if (!adminListEl) return;
    adminListEl.innerHTML = '';

    rawEventsData.forEach((ev, index) => {
        const li = document.createElement('li');
        li.style.display = "flex";
        li.style.justifyContent = "space-between";
        li.style.marginBottom = "6px";
        li.style.alignItems = "center";
        
        li.innerHTML = `
            <span><strong>${ev.date || 'Day ' + ev.day} (${ev.time})</strong>: ${ev.title}</span>
            <button onclick="deleteEvent(${index})" style="background:red; color:white; border:none; padding:2px 6px; cursor:pointer;">Delete</button>
        `;
        adminListEl.appendChild(li);
    });
}

window.deleteEvent = function(index) {
    rawEventsData.splice(index, 1);
    localStorage.setItem('calendarEvents', JSON.stringify(rawEventsData));
    eventsData = expandEvents(rawEventsData);
    renderGrid();
    renderUpcoming();
    renderAdminList();
};

const exportJsonBtn = document.getElementById('exportJsonBtn');
if (exportJsonBtn) {
    exportJsonBtn.addEventListener('click', () => {
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(rawEventsData, null, 4));
        const downloadAnchor = document.createElement('a');
        downloadAnchor.setAttribute("href", dataStr);
        downloadAnchor.setAttribute("download", "events.json");
        document.body.appendChild(downloadAnchor);
        downloadAnchor.click();
        downloadAnchor.remove();
    });
}

// Start app execution
loadEventsAndInit();
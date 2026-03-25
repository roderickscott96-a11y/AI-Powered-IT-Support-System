const ticketForm = document.getElementById("ticketForm");
const ticketList = document.getElementById("ticketList");
const filterCategory = document.getElementById("filterCategory");
const filterPriority = document.getElementById("filterPriority");
const searchInput = document.getElementById("searchInput");
const sortOption = document.getElementById("sortOption");
const exportBtn = document.getElementById("exportBtn");

const totalTicketsEl = document.getElementById("totalTickets");
const openTicketsEl = document.getElementById("openTickets");
const closedTicketsEl = document.getElementById("closedTickets");
const highPriorityTicketsEl = document.getElementById("highPriorityTickets");
const getAiHelpBtn = document.getElementById("getAiHelpBtn");
const aiResult = document.getElementById("aiResult");
let tickets = [];

async function fetchTickets() {
  try {
    const response = await fetch("http://localhost:3000/tickets");
    tickets = await response.json();
    renderTickets();
  } catch (error) {
    console.error("Error fetching tickets:", error);
  }
}

function updateDashboard() {
  if (!totalTicketsEl || !openTicketsEl || !closedTicketsEl || !highPriorityTicketsEl) {
    return;
  }

  totalTicketsEl.textContent = tickets.length;
  openTicketsEl.textContent = tickets.filter(ticket => ticket.status === "Open").length;
  closedTicketsEl.textContent = tickets.filter(ticket => ticket.status === "Closed").length;
  highPriorityTicketsEl.textContent = tickets.filter(ticket => ticket.priority === "High").length;
}

function renderTickets() {
  if (!ticketList) return;

  ticketList.innerHTML = "";
  async function getAiSuggestion() {
  const issueTitle = document.getElementById("issueTitle").value.trim();
  const issueCategory = document.getElementById("issueCategory").value;
  const issueDescription = document.getElementById("issueDescription").value.trim();

  if (!issueTitle || !issueCategory || !issueDescription) {
    aiResult.innerHTML = "<p>Please fill out the ticket title, category, and description first.</p>";
    return;
  }

  aiResult.innerHTML = "<p>Generating AI suggestion...</p>";

  try {
    const response = await fetch("http://localhost:3000/ai-suggest", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        issueTitle,
        issueCategory,
        issueDescription
      })
    });

    const data = await response.json();

    if (!response.ok) {
      aiResult.innerHTML = `<p>${data.error || "AI request failed."}</p>`;
      return;
    }

    aiResult.innerHTML = `
      <h3>AI Suggestion</h3>
      <p><strong>Possible Cause:</strong> ${data.possibleCause}</p>
      <p><strong>Suggested Fix:</strong> ${data.suggestedFix}</p>
      <p><strong>Recommended Priority:</strong> ${data.recommendedPriority}</p>
      <p><strong>Support Summary:</strong> ${data.supportSummary}</p>
    `;
  } catch (error) {
    console.error("Error getting AI suggestion:", error);
    aiResult.innerHTML = "<p>Could not generate AI suggestion.</p>";
  }
}
  const selectedCategory = filterCategory ? filterCategory.value : "All";
  const selectedPriority = filterPriority ? filterPriority.value : "All";
  const searchText = searchInput ? searchInput.value.toLowerCase() : "";
  const selectedSort = sortOption ? sortOption.value : "newest";

  const filteredTickets = tickets.filter(ticket => {
    const matchesCategory =
      selectedCategory === "All" || ticket.issueCategory === selectedCategory;

    const matchesPriority =
      selectedPriority === "All" || ticket.priority === selectedPriority;

    const matchesSearch =
      ticket.issueTitle.toLowerCase().includes(searchText) ||
      ticket.userName.toLowerCase().includes(searchText) ||
      ticket.issueDescription.toLowerCase().includes(searchText);

    return matchesCategory && matchesPriority && matchesSearch;
  });

  const sortedTickets = [...filteredTickets].sort((a, b) => {
    const dateA = new Date(a.createdAt || 0);
    const dateB = new Date(b.createdAt || 0);

    if (selectedSort === "newest") {
      return dateB - dateA;
    } else {
      return dateA - dateB;
    }
  });

  if (sortedTickets.length === 0) {
    ticketList.innerHTML = `<p class="no-tickets">No tickets found.</p>`;
    updateDashboard();
    return;
  }

  sortedTickets.forEach(ticket => {
    const ticketCard = document.createElement("div");
    ticketCard.className =
      ticket.status === "Closed" ? "ticket-card closed" : "ticket-card";

    ticketCard.innerHTML = `
      <div class="ticket-id">${ticket.id}</div>
      <h3>${ticket.issueTitle}</h3>
      <div class="ticket-meta"><strong>User:</strong> ${ticket.userName}</div>
      <div class="ticket-meta"><strong>Category:</strong> ${ticket.issueCategory}</div>
      <div class="ticket-meta"><strong>Priority:</strong> ${ticket.priority}</div>
      <div class="ticket-meta"><strong>Status:</strong> ${ticket.status}</div>
      <div class="ticket-meta"><strong>Created:</strong> ${new Date(ticket.createdAt).toLocaleString()}</div>
      <p>${ticket.issueDescription}</p>
      <div class="ticket-actions">
        <button onclick="editTicket('${ticket.id}')">Edit</button>
        <button class="close-btn" onclick="closeTicket('${ticket.id}')">Close Ticket</button>
        <button class="delete-btn" onclick="deleteTicket('${ticket.id}')">Delete Ticket</button>
      </div>
    `;

    ticketList.appendChild(ticketCard);
  });

  updateDashboard();
}

async function closeTicket(ticketId) {
  try {
    await fetch(`http://localhost:3000/tickets/${ticketId}/close`, {
      method: "PUT"
    });
    fetchTickets();
  } catch (error) {
    console.error("Error closing ticket:", error);
  }
}

async function deleteTicket(ticketId) {
  try {
    await fetch(`http://localhost:3000/tickets/${ticketId}`, {
      method: "DELETE"
    });
    fetchTickets();
  } catch (error) {
    console.error("Error deleting ticket:", error);
  }
}

async function editTicket(ticketId) {
  const ticket = tickets.find(t => t.id === ticketId);
  if (!ticket) return;

  const newTitle = prompt("Edit Title:", ticket.issueTitle);
  const newDescription = prompt("Edit Description:", ticket.issueDescription);

  if (
    newTitle !== null &&
    newTitle.trim() !== "" &&
    newDescription !== null &&
    newDescription.trim() !== ""
  ) {
    ticket.issueTitle = newTitle.trim();
    ticket.issueDescription = newDescription.trim();

    try {
      await fetch(`http://localhost:3000/tickets/${ticketId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(ticket)
      });

      fetchTickets();
    } catch (error) {
      console.error("Error editing ticket:", error);
    }
  }
}

function exportTickets() {
  const dataStr = JSON.stringify(tickets, null, 2);
  const blob = new Blob([dataStr], { type: "application/json" });

  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = "tickets.json";
  link.click();
}

if (ticketForm) {
  ticketForm.addEventListener("submit", async function (event) {
    event.preventDefault();

    const newTicket = {
      userName: document.getElementById("userName").value,
      issueTitle: document.getElementById("issueTitle").value,
      issueCategory: document.getElementById("issueCategory").value,
      priority: document.getElementById("priority").value,
      issueDescription: document.getElementById("issueDescription").value
    };

    try {
      await fetch("http://localhost:3000/tickets", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(newTicket)
      });

      ticketForm.reset();
      fetchTickets();
    } catch (error) {
      console.error("Error submitting ticket:", error);
    }
  });
}
async function getAiSuggestion() {
  const issueTitle = document.getElementById("issueTitle").value.trim();
  const issueCategory = document.getElementById("issueCategory").value;
  const issueDescription = document.getElementById("issueDescription").value.trim();

  if (!issueTitle || !issueCategory || !issueDescription) {
    if (aiResult) {
      aiResult.innerHTML = "<p>Please fill out the ticket title, category, and description first.</p>";
    }
    return;
  }

  if (aiResult) {
    aiResult.innerHTML = "<p>Generating AI suggestion...</p>";
  }

  try {
    const response = await fetch("http://localhost:3000/ai-suggest", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        issueTitle,
        issueCategory,
        issueDescription
      })
    });

    const data = await response.json();

    if (!response.ok) {
      if (aiResult) {
        aiResult.innerHTML = `<p>${data.error || "AI request failed."}</p>`;
      }
      return;
    }

    if (aiResult) {
      aiResult.innerHTML = `
  <h3>${data.fallbackMode ? "Smart Support Suggestion" : "AI Suggestion"}</h3>
  <p><strong>Possible Cause:</strong> ${data.possibleCause}</p>
  <p><strong>Suggested Fix:</strong> ${data.suggestedFix}</p>
  <p><strong>Recommended Priority:</strong> ${data.recommendedPriority}</p>
  <p><strong>Support Summary:</strong> ${data.supportSummary}</p>
  ${data.fallbackMode ? "<p><em>Using fallback support logic because live AI is currently unavailable.</em></p>" : ""}
`;
    }
  } catch (error) {
    console.error("Error getting AI suggestion:", error);
    if (aiResult) {
      aiResult.innerHTML = "<p>Could not generate AI suggestion.</p>";
    }
  }
}
if (filterCategory) {
  filterCategory.addEventListener("change", renderTickets);
}

if (filterPriority) {
  filterPriority.addEventListener("change", renderTickets);
}

if (searchInput) {
  searchInput.addEventListener("input", renderTickets);
}

if (sortOption) {
  sortOption.addEventListener("change", renderTickets);
}

if (exportBtn) {
  exportBtn.addEventListener("click", exportTickets);
}
if (getAiHelpBtn) {
  getAiHelpBtn.addEventListener("click", getAiSuggestion);
}
fetchTickets();
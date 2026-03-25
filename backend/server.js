const express = require("express");
const cors = require("cors");
const sqlite3 = require("sqlite3").verbose();
const OpenAI = require("openai");

const app = express();
app.use(cors());
app.use(express.json());

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

const db = new sqlite3.Database("./tickets.db", (err) => {
  if (err) {
    console.error("Database connection error:", err.message);
  } else {
    console.log("Connected to SQLite database.");
  }
});

db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS tickets (
      id TEXT PRIMARY KEY,
      userName TEXT NOT NULL,
      issueTitle TEXT NOT NULL,
      issueCategory TEXT NOT NULL,
      priority TEXT NOT NULL,
      issueDescription TEXT NOT NULL,
      status TEXT NOT NULL,
      createdAt TEXT NOT NULL
    )
  `, (err) => {
    if (err) {
      console.error("Table creation error:", err.message);
    } else {
      console.log("Tickets table ready.");
    }
  });
});

app.get("/", (req, res) => {
  res.send("Backend is running");
});

app.get("/tickets", (req, res) => {
  db.all(
    "SELECT * FROM tickets ORDER BY datetime(createdAt) DESC",
    [],
    (err, rows) => {
      if (err) {
        console.error("Error fetching tickets:", err.message);
        return res.status(500).json({ error: "Failed to fetch tickets" });
      }

      res.json(rows);
    }
  );
});

app.post("/tickets", (req, res) => {
  const { userName, issueTitle, issueCategory, priority, issueDescription } = req.body;

  const newTicket = {
    id: Date.now().toString(),
    userName,
    issueTitle,
    issueCategory,
    priority,
    issueDescription,
    status: "Open",
    createdAt: new Date().toISOString()
  };

  const sql = `
    INSERT INTO tickets (
      id, userName, issueTitle, issueCategory,
      priority, issueDescription, status, createdAt
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `;

  db.run(
    sql,
    [
      newTicket.id,
      newTicket.userName,
      newTicket.issueTitle,
      newTicket.issueCategory,
      newTicket.priority,
      newTicket.issueDescription,
      newTicket.status,
      newTicket.createdAt
    ],
    function (err) {
      if (err) {
        console.error("Error creating ticket:", err.message);
        return res.status(500).json({ error: "Failed to create ticket" });
      }

      res.json(newTicket);
    }
  );
});

app.put("/tickets/:id", (req, res) => {
  const { userName, issueTitle, issueCategory, priority, issueDescription, status } = req.body;

  db.run(
    `
      UPDATE tickets
      SET userName = ?, issueTitle = ?, issueCategory = ?, priority = ?, issueDescription = ?, status = ?
      WHERE id = ?
    `,
    [userName, issueTitle, issueCategory, priority, issueDescription, status, req.params.id],
    function (err) {
      if (err) {
        console.error("Error updating ticket:", err.message);
        return res.status(500).json({ error: "Failed to update ticket" });
      }

      res.json({ success: true });
    }
  );
});

app.put("/tickets/:id/close", (req, res) => {
  db.run(
    "UPDATE tickets SET status = ? WHERE id = ?",
    ["Closed", req.params.id],
    function (err) {
      if (err) {
        console.error("Error closing ticket:", err.message);
        return res.status(500).json({ error: "Failed to close ticket" });
      }

      res.json({ success: true });
    }
  );
});

app.delete("/tickets/:id", (req, res) => {
  db.run(
    "DELETE FROM tickets WHERE id = ?",
    [req.params.id],
    function (err) {
      if (err) {
        console.error("Error deleting ticket:", err.message);
        return res.status(500).json({ error: "Failed to delete ticket" });
      }

      res.json({ success: true });
    }
  );
});

app.post("/ai-suggest", async (req, res) => {
  const { issueTitle, issueCategory, issueDescription } = req.body;

  const fallbackSuggestions = {
    "WiFi Issue": {
      possibleCause: "The router connection may be unstable, the signal may be weak, or the network adapter may need a reset.",
      suggestedFix: "Restart the router, forget and reconnect to the WiFi network, and restart the computer's network adapter.",
      recommendedPriority: "Medium",
      supportSummary: "This appears to be a network stability issue that can usually be fixed with basic router and adapter troubleshooting."
    },
    "Password Reset": {
      possibleCause: "The user may be entering the wrong password, the account may be locked, or the password may have expired.",
      suggestedFix: "Verify the username, reset the password, and check whether the account is locked.",
      recommendedPriority: "High",
      supportSummary: "This issue affects account access and should be handled quickly so the user can log in again."
    },
    "Software Installation": {
      possibleCause: "The installation may be blocked by permissions, missing system requirements, or a corrupted installer.",
      suggestedFix: "Run the installer as administrator, confirm the device meets requirements, and reinstall using a fresh installer file.",
      recommendedPriority: "Medium",
      supportSummary: "This looks like a software installation problem that may be related to permissions or installation files."
    },
    "Printer Problem": {
      possibleCause: "The printer may be offline, disconnected, out of paper, or using the wrong driver.",
      suggestedFix: "Check printer power and connection, make sure it is online, confirm paper and ink levels, and reinstall the printer driver if needed.",
      recommendedPriority: "Low",
      supportSummary: "This appears to be a printer setup or connectivity issue that can usually be resolved with basic checks."
    },
    "Email Access": {
      possibleCause: "The email password may be incorrect, the account may be locked, or the mail server settings may be wrong.",
      suggestedFix: "Reset the password if needed, verify login details, and recheck email server or app settings.",
      recommendedPriority: "High",
      supportSummary: "This is an email access issue that may interrupt communication and should be resolved quickly."
    },
    "Hardware Issue": {
      possibleCause: "The device may have a failing component, loose connection, or power issue.",
      suggestedFix: "Restart the device, inspect physical connections, test power sources, and replace faulty hardware if necessary.",
      recommendedPriority: "High",
      supportSummary: "This appears to be a hardware-related problem that may need inspection or replacement."
    }
  };

  try {
    const prompt = `
You are an IT support assistant.
Analyze this ticket and return ONLY valid JSON.

Ticket Title: ${issueTitle}
Category: ${issueCategory}
Description: ${issueDescription}

Return this exact JSON shape:
{
  "possibleCause": "short explanation",
  "suggestedFix": "clear troubleshooting steps",
  "recommendedPriority": "Low or Medium or High",
  "supportSummary": "1-2 sentence summary"
}
`;

    const response = await client.responses.create({
      model: "gpt-5.4",
      input: prompt
    });

    const rawText = response.output_text;
    const parsed = JSON.parse(rawText);

    res.json(parsed);
  } catch (error) {
    console.error("AI suggestion error:");
    console.error(error);

    const fallback =
      fallbackSuggestions[issueCategory] || {
        possibleCause: "The issue may be caused by a general system, access, or configuration problem.",
        suggestedFix: "Restart the device, verify settings, confirm permissions, and escalate if the issue continues.",
        recommendedPriority: "Medium",
        supportSummary: "This issue needs general troubleshooting steps first before deeper support is provided."
      };

    res.json({
      ...fallback,
      fallbackMode: true
    });
  }
});

app.listen(3000, () => {
  console.log("Server running on http://localhost:3000");
});
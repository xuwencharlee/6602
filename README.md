# Inbox Flow

Node.js built-in HTTP server and static frontend for email reply tasks.

Run with `node server.js`, then open http://localhost:3000.

Send JSON to `POST http://localhost:3000/webhook`:

```json
{
  "jev_result": "order",
  "email_subject": "原邮件主题",
  "email_body": "需要发送的回复内容",
  "ticket_id": "Gmail Message ID"
}
```

Tasks are held in memory and are cleared when the server restarts. Marking a task done moves it into the completed tab.

-- Termin kann eine Aufgabe einplanen (Event.taskId → Task, beim Löschen der Aufgabe auf NULL).
-- Bewusst nur ADD COLUMN statt Tabelle neu anlegen: So bleiben auch Spalten erhalten,
-- die Prisma nicht kennt (z. B. aus älteren lokalen Versionen), und keine Zeile wird kopiert.
ALTER TABLE "Event" ADD COLUMN "taskId" INTEGER REFERENCES "Task" ("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "Event_taskId_idx" ON "Event"("taskId");

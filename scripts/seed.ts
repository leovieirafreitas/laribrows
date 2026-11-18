/**
 * Dados iniciais: acesso admin, horários, procedimentos de exemplo.
 * Pode rodar várias vezes — só cria o que ainda não existe.
 *   npm run db:seed
 */
import bcrypt from "bcryptjs";
import { db, admins, services, settings, workingHours } from "../src/lib/db";

async function main() {
  await db.insert(settings).values({ id: 1 }).onConflictDoNothing();

  const email = (process.env.ADMIN_EMAIL || "admin@laribrows.com").toLowerCase();
  const password = process.env.ADMIN_PASSWORD || "troque-esta-senha";
  const existingAdmin = await db.select().from(admins).limit(1);
  if (!existingAdmin.length) {
    await db.insert(admins).values({ name: "Lari", email, passwordHash: await bcrypt.hash(password, 10) });
    console.log(`✓ Admin criado: ${email}`);
  }

  const hours = await db.select().from(workingHours);
  if (!hours.length) {
    const h = (weekday: number, isOpen: boolean, start = 9, end = 19, lunch = true) => ({
      weekday,
      isOpen,
      startMin: start * 60,
      endMin: end * 60,
      breakStartMin: lunch ? 12 * 60 : null,
      breakEndMin: lunch ? 13 * 60 : null,
    });
    await db.insert(workingHours).values([
      h(0, false),
      h(1, false),
      h(2, true),
      h(3, true),
      h(4, true),
      h(5, true),
      h(6, true, 9, 15, false),
    ]);
    console.log("✓ Horários: ter–sex 9h–19h (almoço 12h–13h), sáb 9h–15h");
  }

  const existingServices = await db.select().from(services).limit(1);
  if (!existingServices.length) {
    await db.insert(services).values([
      { name: "Design de Sobrancelhas", description: "Mapeamento facial e design personalizado, respeitando o formato natural do seu rosto.", durationMin: 45, priceCents: 6000, sortOrder: 1 },
      { name: "Design com Henna", description: "Design personalizado com aplicação de henna para preencher falhas e realçar o olhar.", durationMin: 60, priceCents: 8500, sortOrder: 2 },
      { name: "Brow Lamination", description: "Alinhamento e fixação dos fios para um efeito volumoso, penteado e natural por semanas.", durationMin: 75, priceCents: 15000, sortOrder: 3 },
      { name: "Micropigmentação Fio a Fio", description: "Técnica que desenha fios realistas, com resultado delicado e duradouro. Inclui avaliação.", durationMin: 150, priceCents: 65000, sortOrder: 4 },
      { name: "Retoque de Micropigmentação", description: "Retoque entre 30 e 60 dias após a micropigmentação para fixação perfeita.", durationMin: 90, priceCents: 25000, sortOrder: 5 },
      { name: "Lash Lifting", description: "Curvatura e nutrição dos cílios naturais, com efeito de olhar aberto e marcante.", durationMin: 60, priceCents: 14000, sortOrder: 6 },
    ]);
    console.log("✓ Procedimentos de exemplo criados");
  }

  console.log("Pronto ✨");
}

main().then(
  () => process.exit(0),
  (err) => {
    console.error(err);
    process.exit(1);
  },
);

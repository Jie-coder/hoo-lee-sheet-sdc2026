// Sample-CV personas for the profile step. Synthetic demo data only; see
// docs/personas.md. `education.level`/`field` are free text per the contract
// comment, so here `field` carries the institution (e.g. "Diploma in
// Business Studies" · "Politeknik Seberang Perai") to match the wireframe.
import { ParsedCVSchema, type LanguageCode, type ParsedCV } from "@/types/contracts";
import { EXAMPLE_AS_OF } from "@/mocks/aisyah";

export const PERSONA_IDS = ["aisyah", "lim-jia-hui", "pravin"] as const;
export type PersonaId = (typeof PERSONA_IDS)[number];

export type PersonaCard = {
  id: PersonaId;
  name: string;
  /** Name in the persona's other script, shown next to `name`. */
  nameLocal?: string;
  initials: string;
  age: number;
  jobTitle: string;
  location: string;
  summary: string;
  cvUrl: string;
  courseLanguages: LanguageCode[];
  /** Base CV skills that did not clear the ESCO match threshold. */
  unmatchedSkills: string[];
  parsed: ParsedCV;
  parsedOn: string;
};

export const PERSONAS: Record<PersonaId, PersonaCard> = {
  aisyah: {
    id: "aisyah",
    name: "Aisyah binti Rahman",
    initials: "AR",
    age: 23,
    jobTitle: "Administrative Clerk",
    location: "Bayan Lepas, Penang",
    summary: "Data entry, scheduling, reports and customer emails at a trading office.",
    cvUrl: "/samples/cv-aisyah-binti-rahman.pdf",
    courseLanguages: ["ms", "en"],
    unmatchedSkills: ["WhatsApp Business", "Volunteer coordination"],
    parsedOn: EXAMPLE_AS_OF,
    parsed: ParsedCVSchema.parse({
      name: "Aisyah binti Rahman",
      roles: [
        {
          title: "Administrative Clerk",
          years: 2,
          tasks: ["Data entry and record keeping", "Scheduling and coordination", "Report filing", "Customer correspondence"],
        },
        {
          title: "Customer Service Assistant",
          years: 1.5,
          tasks: ["Customer correspondence (BM, English)", "Stock list updates", "WhatsApp Business support"],
        },
        {
          title: "Industrial Trainee",
          years: 0.4,
          tasks: ["Filing and document handling", "Office support"],
        },
      ],
      skills: [
        "Data entry and record keeping",
        "Scheduling and coordination",
        "Report filing",
        "Customer correspondence (BM, English)",
        "Attention to detail",
        "Teamwork",
        "Microsoft Excel (filters, basic formulas)",
        "Microsoft Word",
        "Outlook calendar",
        "WhatsApp Business",
        "Google Forms",
        "Stock list updates",
        "Volunteer coordination",
      ],
      education: [{ level: "Diploma in Business Studies", field: "Politeknik Seberang Perai" }],
      languages: ["Bahasa Melayu", "English"],
    }),
  },
  "lim-jia-hui": {
    id: "lim-jia-hui",
    name: "Lim Jia Hui",
    nameLocal: "林佳慧",
    initials: "LJ",
    age: 30,
    jobTitle: "Senior Accounts Assistant",
    location: "Johor Bahru, Johor",
    summary: "Eight years of bookkeeping, reconciliations and e-invoicing for SMEs.",
    cvUrl: "/samples/cv-lim-jia-hui.pdf",
    courseLanguages: ["zh"],
    unmatchedSkills: ["SQL Accounting software", "UBS Accounting"],
    parsedOn: EXAMPLE_AS_OF,
    parsed: ParsedCVSchema.parse({
      name: "Lim Jia Hui",
      roles: [
        {
          title: "Senior Accounts Assistant",
          years: 4,
          tasks: ["Bank reconciliations", "Accounts payable and receivable", "e-Invoicing (MyInvois) submissions", "Month-end closing support"],
        },
        {
          title: "Accounts Assistant",
          years: 3,
          tasks: ["Bookkeeping", "SST filing", "Vendor payment processing"],
        },
        {
          title: "Accounts Clerk (Internship)",
          years: 1,
          tasks: ["Data entry", "Filing and document control"],
        },
      ],
      skills: [
        "Bookkeeping",
        "Bank reconciliation",
        "Accounts payable and receivable",
        "e-Invoicing (MyInvois)",
        "SST and e-filing",
        "Microsoft Excel (VLOOKUP, pivot tables)",
        "SQL Accounting software",
        "Audit support",
        "Payroll processing",
        "Vendor management",
        "Report writing (Chinese, English)",
        "UBS Accounting",
      ],
      education: [{ level: "Diploma in Accountancy", field: "Tunku Abdul Rahman University College (TAR UC)" }],
      languages: ["Mandarin Chinese", "English", "Bahasa Melayu"],
    }),
  },
  pravin: {
    id: "pravin",
    name: "Pravin a/l Murugan",
    initials: "PM",
    age: 23,
    jobTitle: "Customer Support Agent",
    location: "Cyberjaya, Selangor",
    summary: "Environmental science graduate (2025) in a contract call-centre job.",
    cvUrl: "/samples/cv-pravin-a-l-murugan.pdf",
    courseLanguages: ["en"],
    unmatchedSkills: ["CRM software (Zendesk)", "R programming (basic)"],
    parsedOn: EXAMPLE_AS_OF,
    parsed: ParsedCVSchema.parse({
      name: "Pravin a/l Murugan",
      roles: [
        {
          title: "Customer Support Agent",
          years: 1.3,
          tasks: ["Inbound call handling", "CRM case logging", "Email support", "Escalation handling"],
        },
        {
          title: "Environmental Science Intern",
          years: 0.4,
          tasks: ["Water quality sampling", "Lab testing", "Field data recording"],
        },
        {
          title: "Final-year Research Assistant (Volunteer)",
          years: 0.3,
          tasks: ["GIS mapping", "Report writing"],
        },
      ],
      skills: [
        "Customer service (call handling)",
        "CRM software (Zendesk)",
        "Email support",
        "Problem-solving",
        "Data entry",
        "Environmental sampling techniques",
        "R programming (basic)",
        "QGIS mapping",
        "Report writing",
        "Water quality testing",
        "Microsoft Excel (data analysis)",
        "English proficiency (academic writing)",
      ],
      education: [{ level: "BSc (Hons) Environmental Science", field: "Universiti Kebangsaan Malaysia (UKM), 2025" }],
      languages: ["English", "Bahasa Melayu", "Tamil"],
    }),
  },
};

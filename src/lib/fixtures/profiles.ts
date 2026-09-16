import type { Profile } from "@/lib/types";
import { stamps } from "./dates";

/** Equipe Lead Climatização — espelho da seção 1 do seed.sql. */
export const profilesFixture: Profile[] = [
  {
    id: "a0000000-0000-4000-8000-000000000001",
    full_name: "Eduardo Leal",
    role: "admin",
    phone: "(41) 99911-0001",
    avatar_url: null,
    ativo: true,
    ...stamps(),
  },
  {
    id: "a0000000-0000-4000-8000-000000000002",
    full_name: "Fernanda Ribeiro",
    role: "atendente",
    phone: "(41) 99911-0002",
    avatar_url: null,
    ativo: true,
    ...stamps(),
  },
  {
    id: "a0000000-0000-4000-8000-000000000003",
    full_name: "Carlos Menezes",
    role: "tecnico",
    phone: "(41) 99911-0003",
    avatar_url: null,
    ativo: true,
    ...stamps(),
  },
  {
    id: "a0000000-0000-4000-8000-000000000004",
    full_name: "João Pedro Alves",
    role: "tecnico",
    phone: "(41) 99911-0004",
    avatar_url: null,
    ativo: true,
    ...stamps(),
  },
  {
    id: "a0000000-0000-4000-8000-000000000005",
    full_name: "Rafael Siqueira",
    role: "tecnico",
    phone: "(41) 99911-0005",
    avatar_url: null,
    ativo: true,
    ...stamps(),
  },
];

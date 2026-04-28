export interface CidadeSugerida {
  nome: string
  uf: string
}

export const cidadesSugeridas: CidadeSugerida[] = [
  { nome: "Rio de Janeiro", uf: "RJ" },
  { nome: "Niteroi", uf: "RJ" },
  { nome: "Sao Paulo", uf: "SP" },
  { nome: "Campinas", uf: "SP" },
  { nome: "Santos", uf: "SP" },
  { nome: "Belo Horizonte", uf: "MG" },
  { nome: "Uberlandia", uf: "MG" },
  { nome: "Vitoria", uf: "ES" },
  { nome: "Curitiba", uf: "PR" },
  { nome: "Londrina", uf: "PR" },
  { nome: "Florianopolis", uf: "SC" },
  { nome: "Porto Alegre", uf: "RS" },
  { nome: "Brasilia", uf: "DF" },
  { nome: "Goiania", uf: "GO" },
  { nome: "Salvador", uf: "BA" },
  { nome: "Feira de Santana", uf: "BA" },
  { nome: "Recife", uf: "PE" },
  { nome: "Fortaleza", uf: "CE" },
  { nome: "Natal", uf: "RN" },
  { nome: "Joao Pessoa", uf: "PB" },
  { nome: "Maceio", uf: "AL" },
  { nome: "Aracaju", uf: "SE" },
  { nome: "Belem", uf: "PA" },
  { nome: "Manaus", uf: "AM" },
  { nome: "Cuiaba", uf: "MT" },
]

export function valorCidade(cidade: CidadeSugerida): string {
  return `${cidade.nome}::${cidade.uf}`
}

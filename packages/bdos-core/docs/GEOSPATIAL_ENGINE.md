# Geospatial Engine — Documentação Oficial de Arquitetura

Este documento consolida a visão de produto e o modelo conceitual do
Geospatial Engine (Geospatial Design Review — GDR, Release 2.0,
Capítulos 1 e 2), reconciliados com o estado real do código em
`packages/bdos-core/src` a partir da revisão de arquitetura descrita
na Nota de Reconciliação abaixo. Rege-se pelo PRINCIPLE 004 — Spatial
Intelligence, em `BDS_ARCHITECTURE_PRINCIPLES.md`.

---

## NOTA DE RECONCILIAÇÃO ARQUITETURAL (leia antes de implementar)

Esta seção existe porque a visão de produto foi originalmente escrita
sem uma auditoria do código já existente em `packages/bdos-core/src`.
Uma auditoria posterior encontrou três colisões conceituais que
qualquer implementação futura deve respeitar:

1. **"Digital Twin" já é um nome ocupado no código, com outro
   significado.** `domain/digital-twin` hoje é um dataset estático de
   demonstração de um único tenant fictício ("Alpha Engenharia") —
   `AlphaEngenhariaDigitalTwin` é uma composição de arrays
   (`company`, `organization`, `projects`, `contracts`,
   `measurements`, `invoices`, `accountsReceivables`,
   `cashFlowSignals`, `businessEvents`), sem nenhuma dimensão
   espacial. "Digital Twin Operacional", como usado na visão de
   produto do Geospatial Engine, é uma metáfora de produto — não o
   mesmo conceito. **Decisão:** qualquer módulo de código para o
   modelo espacial deve usar um nome distinto (`domain/spatial-object`
   é o nome de trabalho adotado neste documento). Nunca estender,
   renomear ou reaproveitar `domain/digital-twin` para isso sem uma
   decisão arquitetural própria, dedicada e explícita.

2. **"Spatial Confidence" não deve ser uma escala nova.**
   `domain/field-evidence/evidence-confidence.ts` já implementa um
   sistema de confiança determinístico e testado —
   `EvidenceConfidence` (`Low | Medium | High | Verified`) — com uma
   tabela de pontos (`EVIDENCE_CONFIDENCE_POINTS`) que soma 100 e
   define os limiares de cada nível. **Decisão:** Spatial Confidence
   deve compor com essa escala já existente (um novo fator de
   pontuação relacionado à qualidade da referência espacial — por
   exemplo, "geometria obtida por RTK/GNSS" vs. "coordenada aproximada
   declarada manualmente" — somado aos fatores já existentes), nunca
   criar uma segunda escala paralela (Low/Medium/High/Verified
   duplicado com outro nome).

3. **O "Decision Graph" já existe, sob outra forma.** A cadeia
   `Decision` → `DecisionCase` (máquina de estados `Created →
   Observed → Diagnosed → DecisionBuilt → Recommended →
   PlaybookBuilt → ActionPlanReady → Monitoring → Completed →
   Archived`) → `Recommendation.traceability` (`decisionId`,
   `diagnosisId`, `capabilities[]`, `evidenceReferences[]`,
   `businessFactIds[]`) já é, na prática, a estrutura de
   rastreabilidade que a visão de produto chama de "Decision Graph".
   **Decisão:** um Spatial Object deve se tornar referenciável a
   partir dessa cadeia já existente (por exemplo, um campo espacial
   opcional em `BusinessFact` ou em `DecisionEvidence`), nunca nascer
   como uma estrutura de grafo paralela e desconectada.

4. **Já existem duas referências espaciais ad-hoc no código — evidência
   concreta do problema, não hipótese.** `ProjectLocation`
   (`domain/project-management`) e `MeasurementCoordinate`
   (`domain/measurement`) foram criadas de forma independente, cada
   uma com seu próprio par `latitude`/`longitude`, sem nenhuma relação
   entre si. Nenhuma das duas é alterada por este documento — a
   consolidação delas em um modelo espacial único é trabalho de sprint
   futura, explícita, não um efeito colateral de nenhuma mudança
   proposta aqui.

5. **O padrão de extensão correto já existe: `capabilities/`.**
   `capabilities/cash-intelligence` demonstra o padrão sancionado para
   adicionar inteligência de negócio nova ao Decision Engine (Facts →
   Patterns → Rules), sem que a capability conheça React, banco de
   dados, APIs ou os internos do Decision Engine — e sem que domínios
   operacionais importem capabilities diretamente
   (`architecture/engineering-boundaries.test.ts` impõe isso via
   teste). Uma futura `capabilities/geospatial-intelligence` deve
   seguir exatamente esse mesmo padrão.

Com essas reconciliações registradas, o restante deste documento
reproduz a visão de produto e o modelo conceitual originais.

---

# PARTE I — Visão do Produto

## 1. Qual problema o Geospatial Engine resolve?

O problema central não é "a obra não tem mapa". É que **a informação
espacial de uma obra existe, mas está fragmentada, não é rastreável e
não gera decisão automaticamente.** Hoje, o "onde" de uma obra vive
espalhado em pins de Google Maps, pastas de drone, fotos de WhatsApp,
planilhas de topografia e diários de obra — nenhum desses conectado ao
cronograma, à medição ou ao financeiro. O Geospatial Engine resolve a
**decisão espacial**, não o mapa.

Por perfil de stakeholder:

- **Construtoras**: não sabem, em tempo real, *onde* fisicamente o
  cronograma está atrasado, *onde* está havendo retrabalho, nem como
  correlacionar avanço físico com medição financeira em obras
  geograficamente dispersas.
- **Engenharia Consultiva**: precisa atestar avanço e qualidade sem
  estar fisicamente presente o tempo todo.
- **Consórcios**: cada empresa usa uma ferramenta e um formato
  diferente — não existe um "livro-razão espacial" único e neutro.
- **Fiscalização pública**: precisa auditar gasto público contra
  avanço físico real, com trilha defensável.
- **DNOCS**: obras hídricas em áreas do semiárido de difícil acesso —
  verificação presencial é cara e lenta.
- **DER**: infraestrutura linear medida por estaca/km, atravessando
  múltiplos municípios.
- **Prefeituras**: mesma dor em escala menor, com ainda menos
  estrutura de governança de dados.
- **Governo Federal**: precisa de visão consolidada de múltiplos
  contratos em múltiplos estados.

## 2. Quem utilizará o módulo?

| Perfil | Necessidade espacial |
|---|---|
| Diretor | Visão macro de risco geográfico agregado. |
| Sócio | Exposição financeira por região/frente. |
| Engenheiro residente | "Onde está o desvio hoje". |
| Engenheiro de planejamento | Planejado × executado por localização. |
| Topógrafo | Fonte primária de precisão (RTK/GNSS, as-built). |
| Fiscal | Camada de verificação independente, evidência imutável. |
| Cliente/Contratante | Visibilidade sem edição — drill-down de transparência. |
| BBA Advisor | Responde "ONDE ESTÁ O DESVIO?" (PRINCIPLE 001) automaticamente. |

## 3. Quais decisões esse módulo ajudará a tomar?

Onde existe atraso; onde houve avanço; onde houve retrabalho; onde
existe risco (geotécnico, hidrológico, de segurança); onde existem
evidências insuficientes; onde a medição diverge da execução física;
onde existe risco financeiro; onde fisicamente está o caminho crítico;
quais frentes estão paradas e onde; onde há comprometimento logístico;
onde há sobreposição de responsabilidade entre empresas do consórcio;
onde o as-built diverge do as-designed; onde há risco ambiental ou
fundiário; onde a qualidade de execução está abaixo do padrão; onde os
equipamentos estão alocados versus onde deveriam estar; onde existe
dependência entre frentes que pode gerar efeito cascata de atraso; onde
a obra está fisicamente pronta para medição mas ainda não foi medida;
onde a licença ambiental está prestes a ser extrapolada.

## 4. Quais problemas atuais ele elimina?

| Ferramenta atual | Limitação estrutural |
|---|---|
| Excel | Estático, sem correlação espacial, quebra em escala |
| Google Maps | Sem camada planejado×executado, sem controle de acesso, efêmero |
| MS Project | Cronograma sem dimensão espacial |
| WhatsApp | Evidência se perde, sem cadeia de custódia |
| Fotos soltas | Metadado de GPS inconsistente, sem governança |
| Drone | Vira anexo de relatório, não entra no fluxo de decisão |
| Diário de obra | Sequencial, sem índice espacial |
| Topografia convencional | Precisa, mas isolada do financeiro |
| Visitas presenciais | Caras, lentas, viés de amostragem |

O Geospatial Engine não substitui essas fontes — absorve-as como
insumo e as converte em uma camada única de decisão, rastreável e
auditável.

## 5. Diferenciais competitivos

O foco da BBA Platform não é armazenar mapas. É transformar informação
espacial em decisão operacional. Diferenciais: dado espacial como nó
de um grafo de decisão rastreável (PRINCIPLE 001); narração automática
pelo BBA Advisor; Progressive Disclosure aplicado ao geoespacial;
desenho para o contexto regulatório brasileiro de obra pública;
governança multi-stakeholder nativa; correlação simultânea entre
Engines.

## 6. Como esse módulo conversa com os demais Engines?

Planning (casca espacial do cronograma) → Execution (estado
as-performed por local) → Evidence (índice espacial da evidência) →
Measurement (divergência medição×execução por local) → Document
(licenças/ARTs por polígono) → Approval (aprovação condicionada a
evidência espacial) → Finance (custo por local) → Dashboard Executivo
(agregação) → BBA Advisor (responde "ONDE").

## 7. Quais informações entram?

Latitude/Longitude; estaca/km; polígonos de frente de obra; drone
(ortomosaico, nuvem de pontos); fotografias e vídeos geolocalizados;
topografia convencional; RTK/GNSS; Shapefile; GeoJSON; KML/KMZ; Google
Maps/Earth (referência visual); CesiumJS; BIM/IFC georreferenciado;
imagens de satélite; LiDAR; sensores IoT geolocalizados; perímetros
legais (desapropriação, APP, licenciamento); dados de mobilização de
frota/equipamento.

## 8. Quais informações saem?

Indicadores espaciais; alertas geolocalizados; mapas de risco; timeline
espacial (replay); dashboards por camada; relatórios espaciais para
fiscalização; insights narrados pelo BBA Advisor; recomendações de
ação; exportações (shapefile/KML/PDF georreferenciado); trilha de
auditoria espaço-temporal imutável.

## 9. Casos de uso mais importantes

Barragem (DNOCS); rodovia (DER); ponte; hospital; galpão industrial;
saneamento; mineração; energia (linhas de transmissão); consórcio
multi-empresa; fiscalização pública remota; prestação de contas a
órgãos de controle (TCU/TCE/CGU); prefeitura (pavimentação urbana);
governo federal (programa multi-contrato); obras em área de difícil
acesso; obra com licenciamento ambiental condicionado; risco
geotécnico dinâmico; desapropriação/servidão.

## 10. Posicionamento do produto

> "O Geospatial Engine da BBA Platform é a camada que transforma
> qualquer ponto no espaço de uma obra em uma decisão rastreável —
> conectando planejamento, execução, evidência, medição e financeiro a
> um único mapa vivo, auditável e interpretado automaticamente pelo
> BBA Advisor. Não é uma ferramenta de mapas. É a resposta oficial da
> plataforma para a pergunta 'onde'."

Posicionamento correto frente ao mercado: **Operational Digital Twin
Platform** (termo de produto — ver Nota de Reconciliação item 1 sobre
o nome de módulo de código) capaz de transformar informação espacial
em decisão operacional. O BDS não compete com Google Maps, QGIS,
ArcGIS, DroneDeploy, Pix4D, MS Project ou Primavera — nenhuma dessas
ferramentas é uma plataforma de decisão; cada uma pode ser, no máximo,
uma fonte de dado de entrada.

---

# PARTE II — Spatial Object Model

## 11. Spatial Object

Um Spatial Object é a unidade conceitual atômica de representação
espacial dentro do BDS — um ponto, um segmento linear, uma área, um
volume, ou um agrupamento lógico de outros Spatial Objects. É, antes
de tudo, um conceito de negócio com localização, não uma geometria
com metadado de negócio anexado: o objeto de negócio é o objeto
principal, e a geometria é apenas uma de suas propriedades.

## 12. Hierarquia Espacial

```
Obra
  └── Frente / Macroetapa
        └── Trecho / Segmento
              └── Estaca / Ponto
                    └── Elemento construtivo
```

Cada nível é, ele próprio, um Spatial Object. A hierarquia é o eixo
estrutural primário, mas não exclusivo — convive com relações
não-hierárquicas (Capítulo 14).

## 13. Spatial Identity

A geometria de um Spatial Object pode melhorar ao longo do tempo (GPS
aproximado → RTK preciso) sem que sua identidade mude. A geometria é
uma propriedade versionada; a identidade é permanente e estável. Isso
é o que permite que Planning, Execution, Evidence e Measurement se
refiram, sem ambiguidade, ao mesmo Spatial Object mesmo tendo cada um
"conhecido" uma geometria diferente, em um momento diferente.

## 14. Spatial Relationships

Contenção (parte-de); adjacência; sobreposição; dependência; derivação
(subdivisão/fusão, preservando rastreabilidade com a versão anterior);
correspondência (vínculo com um registro de outro Engine); restrição
(um objeto legal/regulatório impõe limite sobre outro).

## 15. Spatial Layers

Camada de planejamento (as-planned); de execução (as-performed);
evidencial; de medição (as-measured/as-paid); financeira;
legal/regulatória. Todas coexistem sobre a mesma identidade espacial —
é isso que possibilita a comparação planejado × executado × medido ×
evidenciado.

## 16. Ciclo de Vida dos Objetos Espaciais

Concepção → Ativação → Evolução → Consolidação → Arquivamento. Um
Spatial Object nunca é excluído — apenas encerrado ou superado por
derivação, preservando a auditabilidade.

## 17. Temporal Layer

Todo Spatial Object carrega o registro cronológico de cada mudança de
estado — não como log acessório, mas como parte constitutiva de sua
definição. É essa sequência ordenada de estados que viabiliza o Replay
Temporal.

## 18. Spatial Confidence

Propriedade formal de qualquer dado ou camada espacial, expressando
seu grau de precisão/confiabilidade como espectro — nunca binário.
**Conforme a Nota de Reconciliação (item 2): compõe com o
`EvidenceConfidence` já existente em `domain/field-evidence`, não cria
uma escala paralela.** Nunca deve ser descartada ou "arredondada para
cima" silenciosamente.

## 19. Spatial Graph

A união da Hierarquia Espacial (Cap. 12) com as Spatial Relationships
(Cap. 14): Spatial Objects como nós, relações como arestas. **Conforme
a Nota de Reconciliação (item 3), este grafo deve se conectar à cadeia
`Decision` → `DecisionCase` → `Recommendation.traceability` já
existente — não nascer como estrutura paralela.**

## 20. Integração com os demais Engines

Planning concebe Spatial Objects (as-planned); Execution ativa/evolui
(as-performed), podendo criar objetos ad-hoc para ocorrências não
previstas; Evidence anexa a camada evidencial com sua própria Spatial
Confidence; Measurement anexa as-measured, reconciliando com os
limites de Execution; Document anexa a camada legal/regulatória (ou
modela o próprio documento como um Spatial Object de restrição);
Approval referencia Spatial Objects e suas camadas; Finance anexa a
camada financeira; Dashboard Executivo agrega pela Hierarquia
Espacial; BBA Advisor percorre o Spatial Graph, pondera a Spatial
Confidence e usa a Temporal Layer para narrar a trajetória, não só o
estado atual.

---

# PARTE III — Roadmap e Estado Atual

## 21. Roadmap Estratégico

- **MVP (concluído — UI Sprint 7)**: tela `/workspaces/engenharia/geoespacial`
  com placeholder de mapa, checklist de camadas, linha do tempo e KPIs
  — 100% mock, sem nenhum modelo de domínio por trás.
- **Release 2.1 (próxima)**: `domain/spatial-object` em
  `packages/bdos-core/src` — tipos puros (SpatialObject, Spatial
  Identity, Spatial Relationship, Spatial Layer, ciclo de vida),
  seguindo a mesma convenção `.ts`/`.types.ts`/`index.ts`/`.test.ts`
  dos demais domínios. Sem API, sem banco de dados, sem UI nova.
- **Release 2.2**: `capabilities/geospatial-intelligence` (Facts →
  Patterns → Rules), seguindo o padrão de `cash-intelligence`, com a
  primeira regra real de correlação espacial; extensão do teste de
  fronteiras arquiteturais (`engineering-boundaries.test.ts`) para
  cobrir a nova capability.
- **Premium**: Replay temporal, BBA Advisor narrando correlações
  espaciais reais, priorização de fiscalização por risco calculado.
- **Enterprise**: consolidação multi-contrato/multi-estado,
  exportação para auditoria externa, modelo de permissão espacial
  multi-stakeholder completo.

## 22. Estado de implementação (atual)

- ✅ Visão de produto e modelo conceitual documentados (este arquivo).
- ✅ PRINCIPLE 004 — Spatial Intelligence formalizado em
  `BDS_ARCHITECTURE_PRINCIPLES.md`.
- ✅ Tela MVP mock em `/workspaces/engenharia/geoespacial` (UI Sprint 7).
- ✅ Reconciliação arquitetural registrada — evita duplicar "Digital
  Twin", "Evidence Confidence" e "Decision Graph" sob nomes novos.
- ⏳ Nenhum código de domínio (`domain/spatial-object`) implementado
  ainda — é a próxima sprint proposta (Release 2.1 acima).
- ⏳ `ProjectLocation` e `MeasurementCoordinate` continuam isolados,
  não consolidados — consolidação é decisão de sprint futura, não
  consequência automática deste documento.

## 23. Recomendações do Chief Product Officer

Ver seção equivalente no corpo histórico do GDR (Capítulos 1 e 2,
registrados na sessão de revisão de produto): oportunidades de
liderança global, riscos arquiteturais, funcionalidades a evitar
deliberadamente (motor topológico próprio, editor GIS genérico,
controle de voo de drone, provedor de tiles próprio) e riscos de
over-engineering (suportar todo formato geoespacial de uma vez,
linguagem de consulta espacial especulativa, precisão submilimétrica
sem validação de demanda) permanecem válidos e devem ser revisitados
a cada Release deste roadmap, não apenas nesta primeira versão.

# R89 | Public work review (read-only, 2026-10-28 JST)

This is an editorial review of **already Public** Stats Maker records; **no live work was changed**. Public work IDs are given solely to distinguish similarly titled works. Do not run write SQL from this document. Respect original authors, their URL links, and ownership authorization.

## Findings

- Public works: **11**. Distinct complete scoring snapshots: **9**.
- Exact duplicate snapshot pairs: **2**.
- `snapshot.metadata.category`: **6 unset**, **3 "other"**, **2 "manga_anime"**.
- Custom `cover_url`: **0/11**. This is not the same as blank cards: automatic previews still exist.
- All score comparisons are presented as authors' subjective evaluations, not official numerical facts.

## Category review (proposal, not applied)

| Public work ID | Current category | Suggested category | Short title |
| --- | --- | --- | --- |
| 1eed295e-9a79-449d-9fd7-e4405e0ae426 | unset | sports | Six footballers, seven criteria |
| a2ca13fa-48b8-42b6-bbd2-b4945acf3aba | unset | manga_anime | ONE PIECE story arcs |
| 2d263df1-17d2-433a-947c-c2b55b6dbecc | unset | sports | Football score B (exact copy of A) |
| 20dbd99d-d8ca-4254-88bc-3753f597b93a | unset | sports | Football score A |
| 57b432ed-fbf2-4261-b57d-9e0f27356d2e | unset | sports | Football re-Remix |
| 5ffb1644-b5f8-434f-b216-27012c90bbfe | unset | manga_anime | ONE PIECE weighted Remix |
| 336d4f99-a9a3-4c12-964d-082a589bdf4c | other | sports | Football alternative scoring |
| 8a6fec8a-dec2-4764-b5c0-91cebf2a0481 | other | sports | Football Remix 2 |
| 071a2bf3-2a17-490d-a2f5-b5b0a5832438 | other | sports | Football Remix 1 |
| 2582c53e-7f4e-47b1-a34b-0986e43ea218 | manga_anime | unchanged | Crossover characters – copied |
| b879b7c4-7470-416e-89b4-c682a09a49fa | manga_anime | unchanged | Crossover characters – original |

Target categories after an *owner-approved* edit would be 7 sports and 4 manga/anime; this reflects the existing titles, not any new user engagement data.

## Duplicates for owner's review

- **Football rating A** (`20dbd99d...`) and **B** (`2d263df1...`) are exactly identical saved snapshots. If both are QA content, retain the representative and consider changing the other to Unlisted rather than deleting it.
- **Crossover original** (`b879b7c4...`) and **copied variant** (`2582c53e...`) are exactly identical saved snapshots. Treat the original as canonical only if the original poster agrees.

**Required before edits:** establish which records belong to the site operator; preserve URLs and Remix attribution; check authorization to change their metadata or visibility; confirm unintended changes would not affect user links. No silent deletion/unlisting or bulk rewriting of Public snapshots. A revision to snapshot JSON can affect search/index projections and should be reviewed as an explicit transaction.

This review is **not** a finding that Google AdSense requires a minimum work count or forbids repeated example data. Unique utility, clearly explained source scoring, and usability matter more than arbitrary counts.

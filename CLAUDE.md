# CLAUDE.md — Instructions pour Claude Code

Monorepo **docs-overlay** : un moteur de documentation versionnée à héritage par overlay.
`apps/docs` est le site de documentation du projet, versionné par docs-overlay lui-même ;
`examples/fumadocs-next` est une **fixture de test** — son contenu est volontairement tordu et
`assert-output.mjs` y assert des chaînes exactes, donc ne jamais fusionner les deux.
`packages/core` est une **librairie TypeScript pure** (aucun framework, aucune dépendance,
aucun `node:*`), `packages/adapters/*` sont les intégrations framework. npm workspaces, build
Vite en mode librairie **ESM only** + `tsc` pour les `.d.ts`, tests Vitest, lint/format
**oxlint + oxfmt**, releases via **Changesets**.

## Règle d'architecture non négociable

La direction de dépendance est **Adapter → Core**, jamais l'inverse.

`packages/core` ne doit jamais importer `react`, `next`, `fumadocs-*`, `astro`, `nextra`,
`vitepress`, ni un module `node:*`. Deux garde-fous le vérifient et **font échouer la CI** :
`packages/core/src/architecture.test.ts` et l'override `no-restricted-imports` de
`.oxlintrc.json` scopé sur `packages/core/src/**`.

Avant d'ajouter une fonctionnalité, se demander : « est-ce que ça relève de la documentation
versionnée elle-même, ou d'un framework de documentation ? ». Si c'est framework-spécifique, ça
va dans un adapter. En particulier, **la grammaire de navigation de Fumadocs** (`pages: []`,
`'...'`, `'!x'`, `root: true`) n'a rien à faire dans le core : les fichiers meta y sont des
payloads opaques, seul l'héritage leur est appliqué, et la fusion passe par un `MetaMerger`
injecté par l'adapter.

## Avant chaque commit

1. **Tests** — `npm test` (ou `npx vitest run <chemin>` pour la zone touchée)
2. **Lint / format** — `npm run lint` et `npm run fmt:check`
3. **Typecheck** — `npm run typecheck`
4. **Changeset** — **obligatoire** dès que la modification touche `packages/core/src` ou
   `packages/adapters/*/src` : sans changeset, la CI `changeset-check` bloque le merge
5. **Commit** — le changeset fait partie du commit de la feature, pas d'un commit séparé

### Écrire le changeset

`npm run changeset` est interactif : inutilisable en session Claude Code. Créer directement
`.changeset/<trois-mots-au-hasard>.md` :

```md
---
"docs-overlay": minor
---

Add `getDependents()` so adapters can invalidate only the versions a changed file actually feeds.
```

- **Bump** : `patch` = correction · `minor` = ajout rétrocompatible · `major` = breaking change.
- **Résumé** : en **anglais** (il atterrit tel quel dans le `CHANGELOG.md`), au présent, orienté
  usage. Nommer les symboles exportés.
- **Un changeset par changement fonctionnel.**
- Aucun changeset pour une PR qui ne touche pas un package publié : `#skip-changeset` dans le
  **titre** de la PR.
- **Ne jamais éditer `version` dans un `package.json`** — c'est Changesets qui le bump.

## Environnement

- **npm workspaces**, pas pnpm, pas NX. Scripts npm standard uniquement.
- **ESM only** pour les deux packages : tous les consommateurs (`fumadocs-core`,
  `source.config.ts`, `lib/source.ts`) sont ESM ; le dual ESM/CJS n'apporterait que le
  dual-package hazard.
- **Imports relatifs avec extension `.js`** obligatoire, même en TS : l'arbre de `.d.ts` émis par
  `tsc` doit rester résoluble chez un consommateur en `moduleResolution: nodenext`.
- **`dist/` est gitignoré** et publié uniquement via le tarball npm (`files: ["dist"]`).
- `npm run typecheck` utilise un alias vers les **sources** du core (dev rapide).
  `npm run typecheck:packaged` typecheck l'adapter contre les **`.d.ts` construits** : c'est lui
  qui valide la map `exports`. Ne pas ajouter de `paths` vers `src` ailleurs.
- Les tests du core sont **fs-free** : les fixtures sont des fabriques TypeScript, pas des
  fichiers sur disque.

## Releases

La CI ne publie jamais. Elle maintient seulement la PR « chore: version packages » ; la merger
bumpe les versions et écrit les changelogs. La publication est **locale** : `npm run release`
(build, revalidation des types packagés et de l'indépendance du core, publish npmjs, un tag par
package). Idempotent : une release interrompue se relance telle quelle. Comme partout ailleurs,
**ne jamais la lancer sans instruction explicite de l'utilisateur**.

## Règles git absolues

- **Ne jamais commiter** sans que l'utilisateur ait confirmé que les changements fonctionnent
- **Ne jamais pusher** sans instruction explicite de l'utilisateur — même après un commit validé
- **Ne jamais publier sur npm** sans instruction explicite
- Ne jamais utiliser `--no-verify`, `--force`, ni sauter les hooks

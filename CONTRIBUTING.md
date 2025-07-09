# Contributing to MCP Replit Claude Max

Merci de votre intérêt pour contribuer à MCP Replit Claude Max ! 

## 🚀 Comment contribuer

### Prérequis
- Node.js 18+
- Docker et Docker Compose
- Claude Code CLI installé et configuré
- Git

### Installation pour le développement

1. **Fork le repository**
   ```bash
   git clone https://github.com/YOUR_USERNAME/mcp-replit-claude-max.git
   cd mcp-replit-claude-max
   ```

2. **Setup du projet**
   ```bash
   npm run setup
   ```

3. **Démarrer en mode développement**
   ```bash
   npm run dev
   ```

### Structure du projet

```
mcp-replit-claude-max/
├── server/           # Backend MCP + API
├── client/           # Frontend React/Next.js
├── shared/           # Types et utilitaires partagés
├── scripts/          # Scripts de setup et déploiement
└── docs/             # Documentation
```

### Types de contributions

- 🐛 **Bug fixes** : Correction de bugs
- ✨ **Features** : Nouvelles fonctionnalités
- 📚 **Documentation** : Amélioration de la documentation
- 🎨 **UI/UX** : Améliorations d'interface
- ⚡ **Performance** : Optimisations

### Processus de contribution

1. **Créer une issue** pour discuter des changements majeurs
2. **Créer une branch** : `git checkout -b feature/amazing-feature`
3. **Développer** en suivant les conventions du projet
4. **Tester** : `npm test`
5. **Commit** : `git commit -m 'Add amazing feature'`
6. **Push** : `git push origin feature/amazing-feature`
7. **Pull Request** avec description détaillée

### Conventions

#### Code Style
- TypeScript pour tout le code
- ESLint + Prettier pour le formatting
- Commentaires JSDoc pour les fonctions publiques
- Tests unitaires avec Jest

#### Commits
- Messages en français ou anglais
- Format conventionnel : `type: description`
- Types : `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`

#### Branches
- `main` : Production
- `develop` : Développement
- `feature/*` : Nouvelles fonctionnalités
- `fix/*` : Corrections de bugs
- `docs/*` : Documentation

### Tests

```bash
# Tests unitaires
npm test

# Tests d'intégration
npm run test:integration

# Tests E2E
npm run test:e2e
```

### Débogage

```bash
# Logs du serveur
npm run logs:server

# Logs des containers
docker-compose logs -f

# Mode debug
NODE_ENV=development npm run dev
```

### Problèmes courants

#### Claude Code non accessible
```bash
# Vérifier l'installation
claude --version

# Re-authentifier
claude auth logout
claude auth login
```

#### Erreurs Docker
```bash
# Nettoyer les containers
docker-compose down --volumes
docker system prune -f

# Reconstruire
docker-compose build --no-cache
```

### Ressources

- [Documentation MCP](https://modelcontextprotocol.io/)
- [Claude Code Guide](https://docs.anthropic.com/claude/docs/claude-code)
- [Next.js Documentation](https://nextjs.org/docs)
- [Docker Compose Reference](https://docs.docker.com/compose/)

### Contact

- Issues GitHub : [Issues](https://github.com/codenolimits/mcp-replit-claude-max/issues)
- Discussions : [Discussions](https://github.com/codenolimits/mcp-replit-claude-max/discussions)
- Email : support@codenolimits.com

## 📄 License

En contribuant, vous acceptez que vos contributions soient sous licence MIT.

---

**Merci pour votre contribution ! 🎉**
# MCP Replit-like IDE with Claude Code Max

🚀 **Interface Replit complète** avec **Claude Code intégré** via votre abonnement Max - sans frais supplémentaires !

## ✨ Fonctionnalités

- **🎨 Interface Replit-like** - File explorer, Monaco Editor, terminal intégré
- **🤖 Claude Code Max** - Intégration native avec votre abonnement
- **🐳 Projets isolés** - Chaque projet dans son container Docker
- **⚡ Temps réel** - WebSocket pour communication live
- **🔧 Multi-langages** - Support Node.js, Python, React, et plus
- **📱 Responsive** - Interface adaptée desktop et mobile

## 🛠️ Prérequis

- **Node.js 18+** et **npm 9+**
- **Docker** et **Docker Compose**
- **Claude Code CLI** installé et connecté à votre compte Max
- **Abonnement Claude Max** actif (100€ ou 200€/mois)

## 🚀 Installation rapide

```bash
# Cloner le repository
git clone https://github.com/codenolimits/mcp-replit-claude-max.git
cd mcp-replit-claude-max

# Setup automatique
npm run setup

# Démarrer l'IDE
npm run dev
```

## 📋 Vérification Claude Code

```bash
# Vérifier que Claude Code est accessible
npm run check-claude

# Si pas installé, installer Claude Code
# Visitez: https://docs.anthropic.com/claude/docs/claude-code
```

## 🎯 Utilisation

1. **Ouvrir l'IDE**: http://localhost:3030
2. **Créer un projet**: Bouton "New Project" → Choisir template
3. **Activer Claude Code**: Panel → "Start Session"
4. **Coder avec AI**: Utiliser les actions rapides ou chat libre

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Frontend (React/Next.js)                 │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────────────────┐ │
│  │ File Tree   │ │ Monaco      │ │   Claude Code Panel     │ │
│  │ Explorer    │ │ Editor      │ │   (Max Integration)     │ │
│  └─────────────┘ └─────────────┘ └─────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                                │
                          WebSocket/HTTP
                                │
┌─────────────────────────────────────────────────────────────┐
│                      MCP Server (Node.js)                  │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────────────────┐ │
│  │ File System │ │ Claude Code │ │   Project Manager       │ │
│  │ Manager     │ │ CLI Bridge  │ │   (Docker)              │ │
│  └─────────────┘ └─────────────┘ └─────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                                │
                    Claude Code CLI (Max)
                                │
┌─────────────────────────────────────────────────────────────┐
│              Projets isolés (Docker containers)             │
└─────────────────────────────────────────────────────────────┘
```

## 💡 Avantages avec Claude Max

- **Pas de frais supplémentaires** - utilise votre abonnement existant
- **Limites partagées** - même quota que Claude web
- **Toutes les fonctionnalités** - accès complet à Claude Code
- **Setup simple** - pas de configuration API complexe

## 🔧 Développement

```bash
# Installer toutes les dépendances
npm run install-all

# Démarrer en mode développement
npm run dev

# Builder pour production
npm run build

# Tests
npm test

# Docker
npm run docker:build
npm run docker:up
```

## 📁 Structure du projet

```
mcp-replit-claude-max/
├── server/                 # Backend MCP + API
│   ├── src/
│   │   ├── mcp/           # MCP Server implementation
│   │   ├── claude-code/   # Claude Code CLI bridge
│   │   ├── filesystem/    # Project & file management
│   │   ├── terminal/      # Terminal management
│   │   └── websocket/     # Real-time communication
│   └── package.json
├── client/                 # Frontend React/Next.js
│   ├── src/
│   │   ├── components/    # IDE components
│   │   ├── hooks/         # Custom hooks
│   │   └── services/      # API services
│   └── package.json
├── shared/                 # Shared types & utilities
├── scripts/               # Setup & deployment scripts
└── docker-compose.yml
```

## 🤝 Contribution

1. Fork le repository
2. Créer une branch feature (`git checkout -b feature/amazing-feature`)
3. Commit les changements (`git commit -m 'Add amazing feature'`)
4. Push la branch (`git push origin feature/amazing-feature`)
5. Ouvrir une Pull Request

## 📄 License

MIT License - voir [LICENSE](LICENSE) pour plus de détails.

## 🆘 Support

- **Issues**: [GitHub Issues](https://github.com/codenolimits/mcp-replit-claude-max/issues)
- **Discord**: [Community Discord](https://discord.gg/your-server)
- **Email**: support@codenolimits.com

## 🎉 Remerciements

- [Model Context Protocol](https://modelcontextprotocol.io/) pour le protocole MCP
- [Anthropic](https://anthropic.com/) pour Claude Code
- [Monaco Editor](https://microsoft.github.io/monaco-editor/) pour l'éditeur
- [xterm.js](https://xtermjs.org/) pour le terminal

---

**Créé avec ❤️ pour la communauté des développeurs**
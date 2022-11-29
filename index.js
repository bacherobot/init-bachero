#!/usr/bin/env node

// Importer des libs
const prompts = require('prompts')
const commandExistsSync = require('command-exists').sync
const execa = require('execa')
const chalk = require('chalk')
const fs = require('fs')
const path = require('path')
const jsonc = require('jsonc')
const ora = require('ora'); var spinner = ora();

// Vérifier la version de NodeJS
if(parseInt(process.versions.node.split('.')[0], 10) < 16) return console.log(chalk.red(`La version actuelle de NodeJS installée sur cet appareil est ${process.versions.node}. Veuillez installer NodeJS v16 ou supérieur.`)) && process.exit();

(async () => {	
	// Afficher un message
	console.log(`Bienvenue dans l'assistant d'installation de Bachero, l'installation va débuter dans quelques instants.`)

	// Vériier que certaines commandes soient disponible
	spinner.text = 'Vérification de certaines commandes'
	spinner.start()
	if(!commandExistsSync('git')) spinner.text = "La commande 'git' n'est pas disponible, veuillez l'installer puis réessayer"
	if(!commandExistsSync('node')) spinner.text = "La commande 'node' n'est pas disponible, veuillez l'installer puis réessayer"
	if(!commandExistsSync('npm')) spinner.text = "La commande 'npm' n'est pas disponible, veuillez l'installer puis réessayer"
	if(spinner.text.startsWith('La commande')) return spinner.fail() && process.exit()
	spinner.stop()

	// Afficher un avertissement
	console.log(chalk.yellow("\nLes fichiers relatifs à l'exécution de Bachero sur cet appareil seront téléchargés."))
	console.log(`--> La création d'une app via le portail Discord Developer ne sera pas faite automatiquement.`)
	console.log(`--> Vous devrez créer une app, puis récupérer le token et l'identifiant du client manuellement.`)
	console.log(`--> En savoir plus : https://bachero.johanstick.me/docs/intro#Cr%C3%A9%C3%A9-une-app-Discord\n`)
	await new Promise((resolve) => { setTimeout(resolve, 5000) })

	// Utiliser Git pour cloner le repo
	console.log(chalk.dim("──────────────────────────────────────────── Clonage du repo"))
	await execa('git', ['clone', 'https://github.com/bacherobot/bot', 'bacherobot'], { cwd: path.resolve(process.cwd()), stdio: 'inherit' }).catch(err => {})

	// Installer les dépendances
	console.log(chalk.dim("──────────────────────────────────────────── Installation des dépendances"))
	await execa('npm', ['install'], { cwd: path.resolve(process.cwd(), 'bacherobot'), stdio: 'inherit' }).catch(err => {})
	console.log(chalk.dim("────────────────────────────────────────────"))

	// Si on a pas de dossier bacherobot, annuler
	if(!fs.existsSync(path.resolve(process.cwd(), 'bacherobot'))) return console.log(chalk.red("Le dossier 'bacherobot' n'a pas été trouvé après la tentative de téléchargements des fichiers. Abandon.")) && process.exit()

	// Proposer de configurer le fichier de configuration du bot
	var bacheroConfigJsonc = (jsonc.parse(fs.readFileSync(path.join(process.cwd(), 'bacherobot', 'config', 'bachero.jsonc'), 'utf8'))).config
	responses_bacheroConfigJsonc = await prompts(bacheroConfigJsonc.map((config) => {
		if(config.type == 'boolean') return { type: 'toggle', name: config.name, message: config.description, initial: config.default }
		if(config.type == 'string') return { type: 'text', name: config.name, message: config.description, initial: config.default }
		if(config.type == 'array') return { type: 'list', name: config.name, message: config.description, initial: config.default, seperator: ';' }
	}))

	// Modifier le fichier de configuration du bot
	bacheroConfigJsonc.forEach((config) => {
		if(config.type == 'boolean') config.value = responses_bacheroConfigJsonc[config.name]
		if(config.type == 'string') config.value = responses_bacheroConfigJsonc[config.name]
		if(config.type == 'array') config.value = responses_bacheroConfigJsonc[config.name]
	})
	fs.writeFileSync(path.join(process.cwd(), 'bacherobot', 'config', 'bachero.jsonc'), jsonc.stringify({ config: bacheroConfigJsonc }, null, 2))

	// Proposer de configurer le fichier .env
	console.log(chalk.dim("────────────────────────────────────────────"))
	var envFile = await prompts([{
		type: 'text',
		name: 'DISCORD_TOKEN',
		message: 'Quel est le token de votre bot Discord ?',
		validate: (value) => value.length > 2 ? true : "Ce token est invalide, voyez ceci : https://discordjs.guide/preparations/setting-up-a-bot-application.html#your-bot-s-token"
	},{
		type: 'text',
		name: 'DISCORD_CLIENT_ID',
		message: "Quel est l'identifiant de votre bot Discord ?",
		validate: (value) => value.length > 2 ? true : "Identifiant invalide, vous pouvez faire clic droit sur le robot depuis Discord et cliquer sur \"Copier l'identifiant\""
	},
	responses_bacheroConfigJsonc['databaseType'] == 'mongodb' ? {
		type: 'text',
		name: 'MONGODB_URL',
		message: "Quel est l'URL de votre base de données MongoDB ?",
		validate: (value) => value.length > 2 ? true : "URL invalide, si vous souhaitez utiliser une base de données JSON, veuillez recommencer l'installation et choisir un autre type de base de donnée"
	} : {}])

	// Modifier le fichier .env
	fs.writeFileSync(path.join(process.cwd(), 'bacherobot', '.env'), Object.keys(envFile).map((key) => `${key}=${envFile[key]}`).join('\n'))

	// Proposer de supprimer des modules préinstallés
	listPreinstalledModules = fs.readdirSync(path.join(process.cwd(), 'bacherobot', 'modules'))
	console.log(chalk.dim("────────────────────────────────────────────"))
	var { preinstalledModulesToDelete } = await prompts({
		type: 'multiselect',
		name: 'preinstalledModulesToDelete',
		message: 'Choissisez les modules préinstallés que vous souhaitez supprimer, si vous le voulez :',
		choices: listPreinstalledModules
	})
	preinstalledModulesToDelete = preinstalledModulesToDelete.map((modulePos) => { return listPreinstalledModules[modulePos] })

	// Supprimer les modules préinstallés
	preinstalledModulesToDelete.forEach((module) => {
		console.log(chalk.gray(`Suppression du module ${module}...`))
		fs.rmSync(path.join(process.cwd(), 'bacherobot', 'modules', module), { recursive: true })
	})

	// Dire que tout devrait être bon
	console.log(chalk.dim("────────────────────────────────────────────"))
	console.log("\nL'installation est terminée ! Bachero devrait être prêt à être démarré sur cet appareil.")
	console.log(`Vous pouvez exécuter la commande ${chalk.cyan("node index.js")} depuis le dossier ${chalk.cyan("bacherobot")} pour démarrer Bachero.`)
	console.log(`Lisez la documentation pour comprendre comment démarrer Bachero sans qu'il ne s'arrête en fermant le terminal --> https://bachero.johanstick.me/docs/intro`)
})();

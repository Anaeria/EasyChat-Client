"use strict";
/*
 * 		EasyChat Client v0.4.1
 *		Release : 28 juillet 2014
 *		par Anaeria (anaeria@gamestories.net)
 *		Documentation and information on : http://easychat.evade-multimedia.net
 *
 *		EasyChat Server by AlexMog : https://github.com/AlexMog/EasyChatServer
 *		Developped and tested by the community : http://melinyel.net
 */




/*
 *		Object			: ChatAPI
 *		Description		: Objet de gestion de la configuration du chat
 *						  Permet la personnalisation des commandes, résultats, smileys, erreurs, rangs et évènements.
 *		Version			: 1.1
 *		Author			: Anaeria
 *		Edition			: Release
 *		Release			: 27 juillet 2014
 */

function ChatAPI() {
	// Gestion des commandes
	this.commands = [];					// Tableau des commandes
	this.callbacks = [];				// Tableau des callbacks des commandes de retour du serveur
	this.smileys = [];					// Tableau des smileys
	this.errorCode = [];				// Tableau des codes d'erreurs
	this.userRanks = [];				// Tableau de conversion des rangs des utilisateurs
	this.specialRank = [];				// Tableau de conversion des rangs spéciaux des utilisateurs (se base sur l'ID des utilisateurs)

	this.avatarsURLPatern = '';			// Patern pour la détection des avatars

	// Origine des messages affichés dans le chat
	this.SYSTEM_MESSAGE = 0;			// Message généré par le client lui-même
	this.SERVER_MESSAGE = 1;			// Message envoyé par le serveur du chat
	this.USER_MESSAGE = 2;				// Message écrit par un utilisateur distant
	this.SELF_MESSAGE = 3;				// Message écrit par l'utilisateur actif du chat
	this.MODERATION_MESSAGE = 4;		// Message généré par une action de modération

	// Types de message affiché par le chat
	this.INFORMATION_MESSAGE = 0;		// Le message est une simple information, elle est uniquement affichée dans la zone de débuggage
	this.EVENT_MESSAGE = 1;				// Le message est un évènement
	this.CHAT_MESSAGE = 2;				// Le message est une ligne de dialogue
	this.ERROR_MESSAGE = 3;				// Le message est une erreur
}

/*
 * Ajoute un rang d'utilisateur
 *		id : rang de l'utilisateur founi dans le retour serveur
 *		name : nom du rang
 */
ChatAPI.prototype.addRank = function(id, name) {
	this.userRanks[id] = name;
};

/*
 * Ajoute un rang d'utillisateur spécial, unique pour un utilisateur désigné par [id]
 *		id : identifiant numérique de l'utilisateur fourni par le retour serveur
 *		name : nom du rang
 */
ChatAPI.prototype.addSpecialRank = function(id, name) {
	this.specialRank[id] = name;
};

/*
 * Ajoute une commande utilisable par le chat
 *		name : nom de la commande utilisé pour le parsing
 *		rank : niveau de droit nécéssaire pour avoir le droit d'exécuter la commande (cf. Rang des utilisateurs)
 *		params : tableau des paramètres de la commande
 *		callback : fonction à exécuter lors de l'exécussion de la commande (après les vérification des paramètres et des droits)
 */
ChatAPI.prototype.addCommand = function(name, rank, params, callback) {
	this.commands[name] = {
		rank: rank,
		params: params,
		callback: callback
	};
};

/*
 * Ajoute un réponse interprétable par le chat
 *		name : nom de la réponse utilisé pour le parsing
 *		params : tableau indiquant la structure des paramètres de retours
 *				 [param1, param2, ....] pour une suite de paramètres ou [[param1, param2, ...]] pour une liste de mêmes paramètres
 *		callback : fonction à exécuter à la fin de l'interprétation de la réponse
 */
ChatAPI.prototype.addResponse = function(name, params, callback) {
	this.callbacks[name] = {
		params: params,
		callback: callback
	};
};

/*
 * Ajout un smiley
 *		code : chaîne de caractère représentant le smiley
 *		mode : mode d'interprétation
 *				false : interprétation stricte
 *				true : interprétation intelligeante : seule les groupes isolés sont interprétés
 *		file : nom du fichier image du smiley
 */
ChatAPI.prototype.addSmiley = function(code, mode, file) {
	this.smileys[code] = {
		file: file,
		mode: mode
	};
};

/*
 * Ajout d'un code d'erreur
 *		code : code d'erreur à interpéter
 *		message : message correspondant au code d'erreur
 */
ChatAPI.prototype.addErrorCode = function(code, message) {
	this.errorCode[code] = message;
};

/*
 * Défini le partern pour la détection des avatars
 *		patern : parten à utiliser
 */
ChatAPI.prototype.setAvatarURLPatern = function(patern) {
	this.avatarsURLPatern = patern;
};




/*
 *		Object			: ChatManager
 *		Description		: Objet de gestion d'une instance de chat
 *		Version			: 1.6
 *		Author			: Anaeria
 *		Edition			: Release
 *		Release			: 27 juillet 2014
 */

function ChatManager() {
	// Configuration interne
	this.clientName = 'EasyChat';		// Nom du client
	this.majorVersion = 0;				// Version majeur du client
	this.minorVersion = 4;				// Version mineur du client
	this.patchVersion = 1;				// Version du patch du client
	this.protocolVersion = '092';		// Version du protocole

	// API
	this.api = null;					// Instance de ChatAPI

	// Gestion des instances
	this.rooms = [];					// Tableau des instances de salles du chat
	this.activeRoom = false;			// Référence de l'instance de salle active
	this.mainRoom = null;				// Référence de la salle principale
	this.myself = false;				// Pseudo de l'utiliateur en cours
	this.myselfUser = false;			// Référence de l'objet ChatUser de l'utilisateur en cours
	this.follow = true;					// Indique si le chat est en état de recevoir des messages (connecté, pas dans un menu d'options...)

	// Attributs Serveur
	this.distantServer = null;			// Instance du WebSocket
	this.localServer = null;			// Instance du serveur de message local
	this.online = false;				// Indique si la chat à connecté à son websocket

	// Paramètres
	this.config = null;					// Objet de configuration personnel de l'utilisateur (stocké en cookie)
	this.defaultConfig = {				// Configuration du chat par défaut, tout les paramètres non présent dans config seront utilisé
		playSounds: true,					// Jouer les sons du chat
		playOnline: true,					// Jouer un son lors d'une entrée dans le chat
		playOffline: true,					// Jouer un son lors d'une sortie dans le chat
		playHint: true,						// Jouer un son lors de la réception d'un message
		playOnlyPrivate: false,				// Ne jouer les sons que pour les discussions privées

		soundVolume: 50,					// Volume des sons (de 0 à 100)
		AFKTime: 2,							// Temps en minute pour qu'un utilisateur soit déclarer absent

		pseudoHighlight: true,				// Active la surbrillance des pseudos dans les messages
		privateAutoOpen: true,				// Ouvre automatique la discussion privée lors de la réception d'un message privé
		hideAutoMsg: false,					// N'affiche pas les messages générés automatiquement
		hidePersoMsg: false,				// N'affiche pas les messages personnalisé du serveur de message local
		hideNotification: false,			// Masque les notifications

		savePseudo: true,					// Mémorise le pseudo de l'utilisateur en cours
		autoLogin: true 					// Se connecte automatiquement lors du chargement du chat si le cookie d'authentification est présent
	};

	this.authInfos = null;				// Informations d'authentification de l'utilisateur

	this.UI = null;						// Instance de l'objet ChatUserInterface

	this.locked = false;				// Indique si la soumission d'un message au chat est authorisé
	this.lockedInterval = 5000;			// Délais de déverouillage (en millisecondes) du chat après la soumission d'un message
}

/*
 * Méthode d'initialisation du manager
 * 		container : id du conteneur html du chat
 *		api : instance de l'objet ChatAPI à utiliser
 */
ChatManager.prototype.init = function(container, api) {

	// Initialisation de la configuration
	if(!this.config) this.config = this.defaultConfig;

	// Inscription de l'api
	this.api = api;

	// Création de l'interface graphique
	this.UI = new ChatUserInterface();
	this.UI.init(container);

	// Création du serveur de message local
	this.localServer = new LocalServer();

	// Création de la salle de discussion principale
	this.mainRoom = this.addRoom('Salle principale', false);
	this.mainRoom.active();

	// Initialise l'état de connexion du chat en "non connacté"
	this.UI.setChatIcon('offline');
};

/*
 * Méthode de connexion au serveur distant
 *		URL : URL de connexion
 */
ChatManager.prototype.connect = function(URL) {
	// Création du serveur distant
    this.distantServer = new DistantServer();
    // Connexion à l'URL
    this.distantServer.init(this, URL);
};

/*
 * Méthode de sauvgarde de la configuration
 */
ChatManager.prototype.saveConfig = function() {
	// Ecriture d'un cookie de 30 jours contenant la configuration en JSON
	setCookie('EasyChatConfig', JSON.stringify(this.config),30);
};

/*
 * Méthode de gestion de l'overture de la conenxion au serveur distant
 */
ChatManager.prototype.onOpen = function() {
	// Actualisation du status de connexion
    this.UI.notification('Vous avez rejoint le chat');
	this.UI.setChatIcon('online');

	// Recherche d'un message contextuel
	var line = this.localServer.getContextMessage();
	if(!this.config.hideAutoMsg && line !== '') this.mainRoom.addMessage(this.api.SYSTEM_MESSAGE, this.api.CHAT_MESSAGE, line);

	// Envoye de la commande CLIENT d'identification au serveur
	this.sendCommand('CLIENT '+ this.clientName +' '+this.protocolVersion+"\r\n");

	// Gestion de la connexion automatique
	var loginSent = false;
	if(this.config.savePseudo || this.config.autoLogin) {
		var auth = getCookie('EasyChatAuth');
		if(auth !== false) {
			this.authInfos = JSON.parse(auth);
			this.myself = this.authInfos.pseudo;
			if(this.config.autoLogin) {
				this.sendCommand('LOGIN ' + this.authInfos.pseudo + ' ' + this.authInfos.password + "\r\n");
				loginSent = true;
			}
		}
	}

	// Si aucune connexion automatique n'a été effectuée, affichage du panneau d'authentification
	if(!loginSent) {
		this.UI.showOptions();
		this.UI.OptionsAuth();
		this.UI.notification('Pour vous connecter, utilisez la commande : /login pseudo mot_de_passe');
	}

	// Notification d'aide
	this.UI.notification('Pour obtenir de l\'aide, utilisez la commande : /help');
};

/*
 * Méthode de gestion de la fermeture du serveur distant
 *		evt : données de l'evènement de fermeture
 */
ChatManager.prototype.onClose = function(evt) {
	// Notification du code et du motif de déconnexion
    this.UI.notification('Vous êtes déconnecté du chat. (Code : '+evt.code+', '+this.localServer.exceptions[evt.code]+')');
};

/*
 * Méthode de gestion de la réception d'un message du serveur distant
 *		evt : données de l'évènement
 */
ChatManager.prototype.onMessage = function(evt) {
	var buf = evt.data;		// Récupération du message

	// Si le message n'est pas un message de confirmation
	if (buf != 'OK') {
		var split = buf.split(' ');		// Sépatation du message
		var args = [];					// Tableau du groupe d'arguments
		var fusionnedArgs = [];			// Tableau des aarguments fusionné
		var response = split[0];		// Le premier mot représente le message de réponse du serveur distant

		// Si la réponse attends une liste de groupes de paramètres
		if(Object.prototype.toString.call(this.api.callbacks[response].params[0]) === '[object Array]') {
			var params = [];	// Initialisation du tableau de lecture des paramètrese
			var tmp = {};		// Initialisation de l'objet d'enregistrement des paramètres

			split.shift();		// Elemination du premier mot pour ne laisser que les groupes de paramètres

			// Pour chaque groupe de paramètres
			split.forEach(function(element) {
				tmp = {};						// Réinitialisation de l'objet d'enregistrement des paramètres
				params = element.split(':');	// Lecture du group de paramètres

				// Pour chaque paramètre l'objet d'enregistrement en construit en associant le nom de l'attribut prévu dans la configuration de la réponse
				for(var p=0;p<params.length;p++) {
					tmp[ChatHandler.api.callbacks[response].params[0][p]] = params[p];
				}

				// Enregistrement du groupe de paramètres
				args.push(tmp);
			});
		// Si la réponse attends un groupe simple de paramètres
		} else {
			// Pour chaque paramètre lu
			for(var i=1;i<split.length;i++) {
				// Si le paramètre est prévu, l'objet d'enregistrement en construit en associant le nom de l'attribut prévu dans la configuration de la réponse
				if(i<=this.api.callbacks[response].params.length) {
					args[this.api.callbacks[response].params[i-1]] = split[i];
				// Si le paramètre n'est pas prévu dans la configuration de la réponse, il est ajouter au tableau des paramètres à fusionner
				} else {
					fusionnedArgs.push(split[i]);
				}
			}
		}
		// Enregistrement des paramètres fusionnés
		args.fusion = fusionnedArgs;

		// Appel du callback de la réponse
		this.api.callbacks[response].callback(this, args);

		// Enregistrement de la réponse brute dans les logs
		this.getActiveRoom().addMessage(this.api.SERVER_MESSAGE, this.api.INFORMATION_MESSAGE, buf);
	}
};

/*
 * Méthode de gestion des erreurs du serveur distant
 */
ChatManager.prototype.onError = function() {
	// Inscription du message d'erreur
    this.getActiveRoom().addMessage(this.api.SERVER_MESSAGE, this.api.ERROR_MESSAGE, 'Erreur de communication avec le serveur !');

    // Tentative de reconnexion toutes les 30 secondes
    setTimeout(function() {
		ChatHandler.connect('ws://mon-serveur.com:8080');
    },30000);
};

/*
 * Méthode de traitement de la sousmission d'une commande
 */
ChatManager.prototype.submitCommand = function() {
	// Récupération du champ de saisie, limité à 500 caractères
	var buf = this.UI.get('#chatInput').val().substr(0,500);

	// Si non vide
	if(buf !== '') {
		// Si une commande est détectée
		if(buf[0] == '/') {
	    	this.command(buf);			// Interprétation de la commande
			this.UI.get('#chatInput').val('');	// Vidage du champ de saisie
		} else {
			// Si le chat n'est pas verouillé
			if(this.locked === false) {
		    	this.command(buf);			// Envoie d'un message
				this.UI.get('#chatInput').val('');	// Vidage du champ de saisie
				this.locked = true;			// Verouillage du chat

				// Timeout de déverouillage du chat
				setTimeout(function() {
					ChatHandler.locked = false;
				}, this.lockedInterval);
			} else {
				// Notification de verouillage
				this.UI.notification('Vous ne pouvez pas envoyer de message ! (max 1 / 5 secs)');
			}
		}
	}
};

/*
 * Méthode d'interprétation d'une commande
 *		buf : commande à interpréter
 */
ChatManager.prototype.command = function(buf) {
	// Si le serveur distant n'est pas en état de recevoir des données
    if(this.distantServer.websocket.readyState != this.distantServer.websocket.OPEN) {
    	this.UI.notification('Impossible de se connecter au serveur');
		return ;		// Abandon de la commande
    }

    var distantCmd = '';	// Initialisation de la commande distante

    // Si la commande est... une commande !!
    if(buf[0] == '/') {
		distantCmd = this.parseCommand(buf);	// Interprétation de la commande
	// Si la commande est un message
    } else {
    	// Ajout d'une ligne de dialogue
    	this.dialogLine(this.api.SELF_MESSAGE, this.myself, buf, this.getActiveRoom().id);

    	// Si la salle de discussion active n'est pas une discussion privée
    	if(this.getActiveRoom().privateChat === false) {
			distantCmd = 'MSG ' + buf;
		} else {
			distantCmd = 'PRIVMSG '+this.getActiveRoom().usersOnline[this.getActiveRoom().privateChat].pseudo+' ' + buf;
		}
    }

    // Envoie de la commande distant, si elle existe, au serveur distant
    if(distantCmd !== '') this.sendCommand(distantCmd + "\r\n");
};


/*
 * Méthode d'exécussion d'une commande serveur
 *		command : commande à exécuter
 */
ChatManager.prototype.parseCommand = function(command) {
	var split = command.split(' ');  					// Séparation des paramètres de la commande
	split[0] = split[0].substring(1, split[0].length);	// Retire le permier caractère de la commande : '/'

	var args = [];				// Initialisation des paramètres de la commande
	var fusionnedArgs = [];		// Initialisation des paramètres fusionné de la commande

	// Pour chaque paramètres détecté
	for(var i=1;i<split.length;i++) {
		// Si le paramètre est prévu, l'objet d'enregistrement en construit en associant le nom de l'attribut prévu dans la configuration de la commande
		if(i<=this.api.commands[split[0]].length) {
			args[this.api.commands[split[0]].params[i-1]] = split[i];
		// Si le paramètre n'est pas prévu dans la configuration de la commande, il est ajouter au tableau des paramètres à fusionner
		} else {
			fusionnedArgs.push(split[i]);
		}
	}

	// Exécussion de la commande
	try {
		args.fusion = fusionnedArgs.join(' ');	// Fusion des arguments
		return this.api.commands[split[0]].callback(this, args);  // Retourne le message à envoyer au serveur
	} catch(e) {
		// La commande n'a pas été trouvée
		this.UI.notification('Commande non prise en charge !');
		return '';
	}
};

/*
 * Méthode d'envoi de message au serveur distant
 *		command : message à envoyer
 */
ChatManager.prototype.sendCommand = function(command) {
	// Si le serveur distant n'est pas en état de recevoir des données
    if (this.distantServer.websocket.readyState != this.distantServer.websocket.OPEN) {
    	this.UI.notification('Impossible de se connecter au serveur');
		return ;		// Abandon de l'envoi
    }

    // Ajout de la commande aux logs
    this.getActiveRoom().addMessage(this.api.USER_MESSAGE, this.api.INFORMATION_MESSAGE, command);

    // Envoie de la commande
    this.distantServer.websocket.send(command);
};

/*
 *	Méthode d'activation d'une discussion privée
 *		id : référence de l'utilisateur en correspondance privée
 */
ChatManager.prototype.switchPrivateRoom = function(id) {
	// Impossible de crée une discussion privée avec soi-même !!
	if(id != this.myselfUser.id) {
		// Recherche si la discussion privée à déjà été crée
		var rid = this.roomExists(this.mainRoom.usersOnline[id].pseudo);
		if(!rid) {
			// Création de la salle de discussion privée si non existante
			var pr = this.addRoom(this.mainRoom.usersOnline[id].pseudo, true).active();
			rid = pr.id;
		}

		this.refheshPrivateUsers();		// Mise à jour de la liste des utilisateurs en discussion privée
		this.UI.displayRoom(rid);		// Affiche de la salle
		this.UI.hidePrivateRooms();		// Masque le sélecteur de conversassion privée
	}
};

/*
 * Méthode de mise à jour des utilisateur en discussion privée
 */
ChatManager.prototype.refheshPrivateUsers = function() {
	var users = [];
	// Recherche et enregistrement de toutes les salles de discussions privées ouverte
	this.rooms.forEach(function(element, index, array) {
		if(element.privateChat) users.push(element.privateChat);
	});

	// Mise à joru de l'état des utilisateurs dans la salle principale
	this.mainRoom.usersOnline.forEach(function(element, index, array) {
		element.isPrivate = ($.inArray(element.id, users) != -1);
	});

	// Mise à jour graphique de la liste des utilisateurs
	this.UI.refreshUserList();
};

/*
 * Méthode d'ajout d'une salle de discussion
 *		roomName : nom de la salle
 *		privateChat : id de l'utilisateur en discussion privée, sinon 0
 */
ChatManager.prototype.addRoom = function(roomName, privateChat) {
	// Création de la salle de discussion
	var room = new ChatRoom();

	// Effacement des messages et de la liste des utilisateurs
	this.UI.cleanMessages();
	this.UI.cleanUsers();

	// Initialisation de la salle de discussion
	room.init(roomName, this, this.rooms.length, privateChat);
	this.rooms.push(room);

	// Retourne l'index de tableau de l'instance de la salle
	return this.rooms[this.rooms.length-1];
};

/*
 * Retourne une instance de salle de discussion
 *		roomId : index du tableau des salles de discussions
 */
ChatManager.prototype.getRoom = function(roomId) {
	return this.rooms[roomId];
};

/*
 * Retourne l'instance de salle de discussion active
 */
ChatManager.prototype.getActiveRoom = function() {
	return this.rooms[this.activeRoom];
};

/*
 * Méthode de vérification de l'existance d'une salle de discussion, retourne don index si trouvée
 */
ChatManager.prototype.roomExists = function(name) {
	var exists = false;
	for(var rn in this.rooms) {
		if(this.rooms[rn].name == name) exists = rn;
	}
	return exists;
};

/*
 * Méthode de mise à jour automatique du chat
 */
ChatManager.prototype.update = function() {
	if(this.activeRoom !== false && this.online) {
		this.sendCommand("LIST\r\n");	// Si l'utilisateur est connexion on réactialise la liste des utilisateurs connectés
	}
};

/*
 * Méthode de d'authentification au serveur distant
 *		login : identifiant de conenxion
 *		password : mot de passe de connexion
 */
ChatManager.prototype.login = function(login, password) {
	this.command('/login '+login+' '+password);
};

/*
 * Méthode de mise à jour du nombre de messages privés non-lus
 */
ChatManager.prototype.updatePrivateMessages = function() {
    var nbUnread = 0;

    // Détection des messages non-lus dans chaque salle de discussions
    this.rooms.forEach(function(room, rid, rooms) {
		room.messages.forEach(function(message, index, array) {
			if(!message.read) nbUnread++;
		});
    });

    // Mise à jour de l'affichage
	this.UI.setPrivateUnread(nbUnread);
};

/*
 * Méthode de traitement d'une ligne de dialogue
 *		origin : émetteur du message (utilisateur, soi-même)
 *		user : pseudo de l'émetteur
 *		message : contenu du message
 *		room : salle de discussion du message
 */
ChatManager.prototype.dialogLine = function(origin, user, message, room) {
	// Récupération de l'utilisateur
	var userObj = this.rooms[room].getUserByName(user);

	// Mise à jour de la date du dernier message et du status absent
	userObj.lastMessage = new Date();
	userObj.isAFK = false;

	// Formatage du message, gestion des caracatères spéciaux, transformation des liens, interprétation des smileys
	var formattedMessage = this.UI.addSmileys(linkify(htmlspecialchars(message, 'ENT_NOQUOTES')));

	// Si la mise en surbrillance du pseudo est activée
	if(this.config.pseudoHighlight) {
		var searchMask = new RegExp(this.myself, 'ig');
		// Recherche du pseudo dans le message
		if(user != this.myself && message.search(searchMask) != -1) {
			formattedMessage = formattedMessage.replace(searchMask,'<span class="selfHighlight">'+this.myself+'</span>');
		}
	}

	// Construction du message
	var html = '<span class="sender" data-id="'+userObj.id+'"><span class="avatar">'+userObj.getAvatar(16)+'</span><span class="pseudo">' + (user==this.myself?'Moi':user) + '</span><span class="dropdown">Dropdown</span></span><span class="separator">:</span><span class="message">' + formattedMessage + '</span>';

	// Ajout du message à la salle de discussion
    this.rooms[room].addMessage(origin, this.api.USER_MESSAGE, html);
};

/*
 * Méthode d'ajout d'un utilisateur
 *		user : pseudo de l'utilisateur
 *		id : identifiant de l'utilisateur
 *		rank : rang de l'utilisateur
 */
ChatManager.prototype.addUser = function(user, id, rank) {
	// Si l'utilisateur n'existe pas, il est crée
	if(typeof(this.mainRoom.usersOnline[id]) == 'undefined') {
		this.mainRoom.usersOnline[id] = new ChatUser();
		this.mainRoom.usersOnline[id].create(user, id, rank);
		this.mainRoom.usersOnline[id].setOnline();
	// Sinon, on ajoute une nouvelle instance
	} else {
		this.mainRoom.usersOnline[id].instances++;
		this.mainRoom.usersOnline[id].setOnline();
	}

	// Mise à jour de la liste des utilisateurs
	this.UI.refreshUserList();
};



/*
 *		Object			: ChatRoom
 *		Description		: Objet de gestion d'une instance de chat par websocket
 *		Version			: 1.2
 *		Author			: Anaeria
 *		Edition			: Release
 *		Release			: 27 juillet 2014
 */

function ChatRoom() {
	this.name = '';				// Nom de l'instance
	this.id = false;				// Référence de l'instance dans le ChatManager

	this.manager = false;			// Instance du Manager

	this.messages = [];				// Tableau des messages de la salle

	this.usersOnline = [];			// Tableau des utilisateurs connecté à l'instance
	this.privateChat = false;		// Défini si l'instance en cours est une instance privée ou non
}

/*
 * Méthode d'initialisation de la salle de discussion
 *		roomName : nom de la salle
 *		manager : instance du manager
 *		id : index du tableau de référence dans le manager
 *		provateChat : identifiant de l'utilisateur si salle privée, ou 0
 */
ChatRoom.prototype.init = function(roomName, manager, id, privateChat) {
    this.name = roomName;
    this.manager = manager;
    this.id = id;
    this.privateChat = privateChat;
};

/*
 * Méthode d'activation d'une instance, elle deviendra l'instance visible par l'utilisateur
 */
ChatRoom.prototype.active = function() {
	// Inscription de l'activation dans le manager
	this.manager.activeRoom = this.id;
	this.manager.follow = true;

	// Si la salle est privée
	if(this.privateChat) {
		// Récupération des instances d'utilisateurs actifs dans la discussion privée
		var myself = this.manager.mainRoom.getUserByName(this.manager.myself);
		var to = this.manager.mainRoom.getUserByName(this.name);

		// Inscription des utilisateurs acatifs dans la salle privée
		if(myself && to) {
			this.usersOnline[myself.id] = myself;
			this.usersOnline[to.id] = to;
			this.privateChat = to.id;
		}
	}

	// Affichage de la salle de discussion
	this.manager.UI.displayRoom(this.id);
	return this;
};

/*
 * Méthode d'ajout d'un message à la salle
 *		origin : origine du message
 *		type : type de message (serveur, erreur, évènement, dialogue, ...)
 *		message : contenu du message
 */
ChatRoom.prototype.addMessage = function(origin, type, message) {
	// Si le message est distiné aux logs, ajouts du formatage directionnel
	if(type == Chat.INFORMATION_MESSAGE) {
		if(origin == Chat.SERVER_MESSAGE) {
			message = '<<< '+message;
		} else if(origin == Chat.USER_MESSAGE) {
			message = '>>> '+message;
		}
		// Inscription du message dans les logs
		this.manager.localServer.addMessage(origin, type, message);
	} else {
		// Création d'un nouveau message
		var chatMessage = new ChatMessage();
		chatMessage.set(origin, type, message, new Date());
		this.messages.push(chatMessage);

		// Affichage du message
		if(ChatHandler.follow && this.manager.activeRoom == this.id) ChatHandler.UI.displayMessage(chatMessage);
	}
};

/*
 * Méthode de recherche d'un utilisateur par son peudo
 *		name : pseudo de l'utilisateur
 */
ChatRoom.prototype.getUserByName = function(name) {
	var user = false;
	for(var id in this.usersOnline) {
		// La recherche n'est pas sensible à la casse
		if(this.usersOnline[id].pseudo.toLowerCase() == name.toLowerCase()) user = this.usersOnline[id];
	}
	return user;
};




/*
 *		Object			: ChatUser
 *		Description		: Objet de gestion d'un utilisateur du chat
 *		Version			: 1.2
 *		Author			: Anaeria
 *		Edition			: Release
 *		Release			: 27 juillet 2014
 */

function ChatUser() {
	this.id = false;			// Identifiant de l'utilisateur
	this.pseudo = '';			// Pseudo
	this.rank = 0;				// Rang (membre, modo, admin, ...)
	this.avatar = false;		// URL de l'avatar
	this.formats = ['jpg', 'png', 'gif'];

	this.lastMessage = null;	// Date de dernier message

	this.instances = 0;			// Nombre d'instances de connexions
	this.isOnline = false;		// Indique si l'utilisateur est connecté
	this.isAFK = false;			// Indique si l'utilisateur est absent
	this.isWritting = false;	// Indique si l'utilisateur est en train d'écrire
	this.isMobile = false;		// Indique si l'utilisateur est sur mobile
	this.isPrivate = false;		// Indique si l'utilisateur à une conversation privée en cours
}

/*
 * Méthode de création d'un utilisateur
 *		user : pseudo de l'utilisateur
 *		id : identifiant de l'utilisateur
 *		rank : rang de l'utilisateur
 */
ChatUser.prototype.create = function(user, id, rank) {
	this.pseudo = user;
	this.id = parseInt(id);		// Assure l'enregistrement de l'id en int
	this.rank = parseInt(rank);		// Assure l'enregistrement du rang en int
	this.instances = 1;

	// Détection de l'existance d'un avatar
	this.checkAvatar(0);
};

/*
 * Définit un utilisateur en ligne
 */
ChatUser.prototype.setOnline = function() {
	this.isOnline = true;
};

/*
 * Méthode de gestion lorsqu'un utilisateur se déconnecte
 */
ChatUser.prototype.setOffline = function() {
	// Mise à jour du nombre d'instances de conexion actives
	this.instances--;

	// Mise à jour du statu en ligne
	if(this.instances === 0) {
		this.isOnline = false;
	}
};

/*
 * Retourne le rang texte de l'utilisateur
 */
ChatUser.prototype.getRank = function() {
	var strRank = '';

	// Recherche du rang dans la configuration de l'API
	if(this.rank in ChatHandler.api.userRanks) {
		strRank = ChatHandler.api.userRanks[this.rank];
	} else {
		strRank = 'Alien';
	}

	// Application du rang spécial
	if(this.id in ChatHandler.api.specialRank) {
		strRank = ChatHandler.api.specialRank[this.id];
	}

	return strRank;
};

/*
 * Retourne le grade texte de l'utilisateur
 */
ChatUser.prototype.getGrade = function() {
	return '';
};

/*
 * Teste l'existance d'un avatar aux différent formats
 *		format : index du tableau de format
 */
ChatUser.prototype.checkAvatar = function(format) {
	var localInstance = this;
	// Si aucun avatar n'est enregistré
	if(this.avatar === false) {
		// Test de récupération de l'image
		image(this.getURLPatern(this.formats[format]), {
			// L'image existe
			success : function () {
				var iFormat = format;
				var iInst = localInstance;

				// Enregistrement de l'avatar
				return function() {
					iInst.avatar = iInst.getURLPatern(iInst.formats[format]);
					ChatHandler.UI.refreshUserList();
				};
			}(),
			// L'image n'existe pas
    		failure : function () {
    			var iFormat = format+1;
    			var iInst = localInstance;

    			return function() {
    				if(iFormat < iInst.formats.length) {
    					// Test du format d'image suivant
						iInst.checkAvatar(iFormat);
    				}
    			};
    		}()
		});
	}
};

/*
 * Méthode de génération de l'avatar
 *		size : taille de l'image rendu
 */
ChatUser.prototype.getAvatar = function(size) {
	return '<img src="'+(this.avatar===false?'/img/no_'+size+'.jpg':this.avatar)+'" width="'+size+'" height="'+size+'" alt="'+this.pseudo+'">';
};

/*
 * Méthode de contruction du partern des avatars
 *		format : format de l'image à tester
 */
ChatUser.prototype.getURLPatern = function(format) {
	var str = Chat.avatarsURLPatern;
	str = str.replace('##FORMAT##', format);
	str = str.replace('##ID##', this.id);
	str = str.replace('##PSEUDO##', this.pseudo);
	str = str.replace('##RANK##', this.rank);
	return str;
};




/*
 *		Object			: ChatMessage
 *		Description		: Objet de gestion d'un message de chat
 *		Version			: 1.0
 *		Author			: Anaeria
 *		Edition			: Release
 *		Release			: 27 juillet 2014
 */

function ChatMessage() {
	this.origin = null;		// Origine du message
	this.type = null;		// Type de message
	this.message = null;	// Contenu du message
	this.date = null;		// Date d'émission du message

	this.read = false;		// Indique si le message à été lu ou non
}

/*
 * Méthode de définition du message
 *		origin : origine du message
 *		type : type de message
 *		message : contenu du message
 *		date : date d'émission du message
 */
ChatMessage.prototype.set = function(origin, type, message, date) {
	this.origin = origin;
	this.type = type;
	this.message = message;
	this.date = date;
};




/*
 *		Object			: LocalServer
 *		Description		: Objet de gestion des messages locaux
 *		Version			: 1.0
 *		Author			: Anaeria
 *		Edition			: Release
 *		Release			: 27 juillet 2014
 */

function LocalServer() {
	this.logs = [];		// Tableaux des logs

	// Messages aléatoires de bienvenu d'un utilisateur
	this.WelcomeStatements = [
			'Quelle joie de le revoir',
			'Bienvenue',
			'Levons nos verres',
			'Respect robustesse !',
			'Encore lui ?',
			'On a encore une place de libre'
		];

	// Messages aléatoirs de départ d'un utilisateur
	this.QuitStatements = [
			'Parti trop vite...',
			'Si jeune !',
			'Adieu',
			'Nooooonnnnnn Gandalf',
			'C\'était l\'élu',
			'Il reviendra'
		];

	// Messages aléatoires de connexion matinale
	this.MorningStatement = [
			'T\'es matinal',
			'Tu me réveille',
			'C\'est déjà l\'heure de se lever'
		];

	// Messages aléatoires de connexion tardive
	this.EveningStatement = [
			'T\'as passé une bonne journée ?',
			'On fini la journée ensemble ?',
			'Il commence à se faire tard'
		];

	// Messages aléatoires de connexion nocturne
	this.NightStatement = [
			'C\'est l\'heure de se coucher',
			'J\'ai sommeil',
			'ZZZZzzzzzz'
		];

	// Traduction des codes d'exceptions du websocket
	this.exceptions = {
		1000: 'Normal Closure',
		1001: 'Going Away',
		1002: 'Protocol error',
		1003: 'Unsupported Data',
		1004: '---Reserved----',
		1005: 'No Status Rcvd',
		1006: 'Abnormal Closure',
		1007: 'Invalid frame payload data',
		1008: 'Policy Violation',
		1009: 'Message Too Big',
		1010: 'Mandatory Ext.',
		1011: 'Internal Server Error',
		1015: 'TLS handshake'
	};
}

/*
 * Méthode d'ajout d'un message aux logs
 *		origin : origine du message
 *		type : type de message
 *		message : contenu du message
 */
LocalServer.prototype.addMessage = function(origin, type, message) {
	var log = [];
	log.ORIGIN = origin;
	log.TYPE = type;
	log.MESSAGE = message;
	log.DATE = new Date();
	this.logs.push(log);
};

/*
 * Retourne le tableau des logs
 */
LocalServer.prototype.getLogs = function() {
	return this.logs;
};

/*
 * Retourne un message de bienvenu aléatoire
 */
LocalServer.prototype.getWelcomeMessage = function() {
	return this.WelcomeStatements[Math.floor(Math.random() * this.WelcomeStatements.length)];
};

/*
 * Retourne un message d'au revoir aléatoire
 */
LocalServer.prototype.getGoodbyeMessage = function() {
	return this.QuitStatements[Math.floor(Math.random() * this.QuitStatements.length)];
};

/*
 * Méthode de génération d'un message contextuel
 */
LocalServer.prototype.getContextMessage = function() {
	var now = new Date();
	var line = '';

	// Le message s'adapte en fonction de l'heure du jour
	switch(true) {
		case (now.getHours()<6):
			line = this.NightStatement[Math.floor(Math.random() * this.NightStatement.length)];
			break;
		case (now.getHours()>=6 && now.getHours()<8):
			line = this.MorningStatement[Math.floor(Math.random() * this.MorningStatement.length)];
			break;
		case (now.getHours()>=21):
			line = this.EveningStatement[Math.floor(Math.random() * this.EveningStatement.length)];
			break;
		default:
			line = '';
			break;
	}
	return line;
};




/*
 *		Object			: DistantServer
 *		Description		: Objet de gestion du serveur distant
 *		Version			: 1.0
 *		Author			: Anaeria
 *		Edition			: Release
 *		Release			: 27 juillet 2014
 */

function DistantServer() {
	this.manager = null;		// Instance du manager
	this.URL = null;			// URL de conenxion au serveur
	this.websocket = null;		// Instance du websocket
}

/*
 * Méthode d'initialisation du serveur distant
 */
DistantServer.prototype.init = function(manager, URL) {
	// Enregistrement des paramètres
	this.URL = URL;
	this.manager = manager;

	// Création du WebSocket
	this.websocket = new WebSocket(URL);

	// Création des évènements de gestion du websocket
	var localInstance = this;
    this.websocket.onopen = function(evt) { localInstance.manager.onOpen(evt); };
    this.websocket.onclose = function(evt) { localInstance.manager.onClose(evt); };
    this.websocket.onmessage = function(evt) { localInstance.manager.onMessage(evt); };
    this.websocket.onerror = function(evt) { localInstance.manager.onError(evt); };
};





/*
 *		Object			: ChatUserInterface
 *		Description		: Objet de gestion de l'interface graphique
 *		Version			: 1.0
 *		Author			: Anaeria
 *		Edition			: Release
 *		Release			: 27 juillet 2014
 */

function ChatUserInterface() {
	this.container = null;						// Contenaire HTML principal du chat
	this.WaitingNotifications = [];				// Tableau des notifications en attente
	this.notifInDisplay = false;				// Indique di une notification est en cours d'affichage

	this.currentMousePos = { x: 0, y: 0 };		// Position courante de la souris

	this.fadeInDelay = 250;						// Durée de fade in des notifications (en millisecondes)
	this.dateOutDelay = 2000;					// Durée de fade out des notifications (en millisecondes)
	this.notifDuration = 3000;					// Durée d'affichage des notifications (en millisecondes)
}

/*
 * Méthode d'initialisation de l'interface graphique du chat
 *		caontiner : conteneur HTML du chat
 */
ChatUserInterface.prototype.init = function(container) {
	this.container = $('#'+container);
	if(this.container.length !== 0) {
		var content = '';

		content += '<div id="titleBar">';
			content += '<div id="options"><span id="sizeToggle" class="ic_sizeDown"></span></div>';
			content += '<div id="statusIcon"><span class="statusBubble loading"></span></div>';
			content += '<div id="title"><em>En chargement</em></div>';
		content += '</div>';
		content += '<div id="corpus">';
			content += '<div id="roomSelection">';
				content += '<div id="roomsSwitch"><span class="ic_rooms"></span></div>';
				content += '<div id="privateRoomsSwitch"><span class="ic_privateRooms"></span><div id="privateRoomsCounter">0</div></div>';
				content += '<div id="logSwitch"><span class="ic_srvLogs"></span></div>';
				content += '<a id="chatVersion" href="http://easychat.evade-multimedia.net" title="">v'+ChatHandler.majorVersion+'.'+ChatHandler.minorVersion+(ChatHandler.patchVersion===0?'':'.'+ChatHandler.patchVersion)+'</a>';
			content += '</div>';
			content += '<div class="layout" id="mainLayout">';
				content += '<div id="userArea">';
				content += '</div>';
				content += '<div id="chatArea">';
				content += '</div>';
				content += '<div id="notificationBox"></div>';
				content += '<div id="inputArea">';
					content += '<div id="commandZone">';
						content += '<span id="sendBtn">Envoyer</span>';
						content += '<span id="configBtn"><span class="ic_config"></span></span>';
					content += '</div>';
					content += '<div id="promptZone"><input type="text" id="chatInput" placeholder="Entrez un message ou une commande" maxlength="500" /></div>';
				content += '</div>';
			content += '</div>';
		content += '</div>';

		this.container.html(content);

	} else {
		alert('Erreur d\'initialisation d\'EasyChat : Conteneur introuvable !');
	}
};

/*
 * Recherche un élément HTML à l'intérieur du chat
 *		find : sélecteur jQuery à rechercher
 */
ChatUserInterface.prototype.get = function(find) {
	return this.container.find(find);
};

/*
 * Change le titre du chat
 *		title : titre du chat
 */
ChatUserInterface.prototype.setGlobalTitle = function(title) {
	this.get('#titleBar').find('#title').html(title);
};

/*
 * Vide l'affichage des messages
 */
ChatUserInterface.prototype.cleanMessages = function() {
	this.get('#chatArea').html('');
};

/*
 * Vide l'affichage de la liste des utilisateurs
 */
ChatUserInterface.prototype.cleanUsers = function() {
	this.get('#userArea').html('');
};

/*
 * Affiche les logs
 */
ChatUserInterface.prototype.showLogs = function() {
	// Blocage de la réception des messages
	ChatHandler.follow = false;

	// Nettoyage de l'interface
	this.cleanMessages();
	this.cleanUsers();

	// Affichage des logs
	ChatHandler.localServer.getLogs().forEach(function(element, index, array) {
		ChatHandler.UI.displayEntry(['msg_'+element.TYPE,'origin_'+element.ORIGIN], element.MESSAGE, element.DATE);
	});
};

/*
 * Méthode d'ajout des smiley dans un message
 *		text : message à analyser
 */
ChatUserInterface.prototype.addSmileys = function(text) {
  var rexp = null;

  // Test pour chaque smiley enregistré dans l'API
  for(var str in ChatHandler.api.smileys) {
  	// Le smiley est interprété si il est isolé du texte
  	if(ChatHandler.api.smileys[str].mode) {
		rexp = new RegExp("([\W]|[^a-z0-9])("+rescape(str)+")|(^("+rescape(str)+"))", "gi");
	// Le smiley est tout le temps interprété
  	} else {
  		rexp = new RegExp(''+str+'', 'g');
  	}
  	// Remplacement du code du smiley par la structure de l'image
    text = text.replace(rexp,'</span>&nbsp;<img class="smiley" src="/img/smileys/'+ChatHandler.api.smileys[str].file+'.gif" alt="('+str+')" />&nbsp;<span class="vamt">');
  }
  return '<span class="vamt">'+text+'</span>';
};

/*
 * Méthode d'affichage d'une entrée
 * 		classes : tableau de classes CSS à ajouter à l'entrée
 *		message : message à afficher
 *		date : date du message
 */
ChatUserInterface.prototype.displayEntry = function(classes, message, date) {
	var buf = '<span class="entry '+classes.join(' ')+'">'+htmlspecialchars(message)+'<span class="dateMsg">'+date.toLocaleDateString()+' <strong>'+date.toLocaleTimeString()+'</strong></span></span>';
	this.get('#chatArea').append(buf);
};

/*
 * Méthode d'ajout d'une notification
 *		message : message de la notification
 */
ChatUserInterface.prototype.notification = function(message) {
	if(!ChatHandler.config.hideNotification) {
		// Ajout du message à la file d'attente
		this.WaitingNotifications.push(message);

		// Affichage direct si aucune notification n'est en cours d'affichage
		if(this.notifInDisplay === false) {
			this.notifInDisplay = true;
			this.dispalyNotifications();
		}
	}
};

/*
 * Méthode d'affichage des notifications
 */
ChatUserInterface.prototype.dispalyNotifications = function() {
	if(this.WaitingNotifications.length > 0) {
		var message = this.WaitingNotifications[0];

		var nf = this.get('#notificationBox');

		// Formatage du conteneur des notifications (nécéssaire en cas de redimmentionnement de la fenêtre)
		nf.html(message);
		nf.css('marginTop', (-1*(nf.height()+20))+'px');
		nf.width((this.get('#chatArea').width()-20)+'px');

		// Affichage de la notification
		nf.fadeIn(this.fadeInDelay, function() {
			// Création de l'évènement de disparission de la notification
			setTimeout(function() {
				ChatHandler.UI.hideNotification();
			}, ChatHandler.UI.notifDuration);
		});
	} else {
		this.notifInDisplay = false;
	}
};

/*
 * Méthode de masquage des notifications
 */
ChatUserInterface.prototype.hideNotification = function() {
	// Effet de disparition
	this.get('#notificationBox').fadeOut(this.fadeOutDelay, function() {
		// Le message afficher est retirer de la file d'attente
		ChatHandler.UI.WaitingNotifications.shift();

		// Affichage des messages restants
		ChatHandler.UI.dispalyNotifications();
	});
};

/*
 * Méthode de mise à jour de la liste des utilisateurs
 */
ChatUserInterface.prototype.refreshUserList = function() {
	// Nettoyage de la liste des utilisateurs
	this.cleanUsers();

	// Si le chat est actif
	if(ChatHandler.follow) {
		// !! COPIE !! du tableau des utilisateurs en ligne
		var usersInRoom = ChatHandler.getActiveRoom().usersOnline.slice();

		// Tri en fonction du rang, de l'AFK et enfin du pseudo
		var users = usersInRoom.sort(function(a,b) {
			if(a.rank > b.rank) return 1;
			if(a.rank < b.rank) return -1;

			if(!a.isAFK && b.isAFK) return 1;
			if(a.isAFK && !b.isAFK) return -1;

			if(a.pseudo.toLowerCase() > b.pseudo.toLowerCase()) return 1;
			if(a.pseudo.toLowerCase() < b.pseudo.toLowerCase()) return -1;

			return 0;
		});

		// Affichage de chaque utilisateur
		for(var id in users) {
			if(users[id].isOnline) {

				// Mise à jour du status AFK
				if(users[id].lastMessage) {
					var date = new Date();
					if(Math.abs(date - users[id].lastMessage) > (ChatHandler.AFKTime*60000)) users[id].isAFK = true;
				}

				var buf = '<span class="chatUser rank_'+users[id].rank+'" data-id="'+users[id].id+'"><span class="avatar">'+users[id].getAvatar(30);

				// Icone AFK
				if(users[id].isAFK) {
					buf += '<span class="ic_miniAfk"></span>';
				}

				// Icone mobile
				if(users[id].isMobile) {
					buf += '<span class="ic_miniMobile"></span>';
				}

				// Icone de discussion privée
				if(users[id].isPrivate) {
					buf += '<span class="ic_miniChat"></span>';
				}

				// Indicateur du nombre d'instances
				if(users[id].instances > 1) {
					buf += '<span class="miniInstances">'+users[id].instances+'</span>';
				}

				buf += '</span><span class="pseudo">'+users[id].pseudo+'<br /><span class="rank">'+users[id].getRank()+'</span></span></span>';
				this.get('#userArea').append(buf);
			}
		}
	}
};

/*
 * Méthode d'affichage d'un message
 *		chatMessage : instance de ChatMessage à afficher
 */
ChatUserInterface.prototype.displayMessage = function(chatMessage) {

	// Construction du message
	this.get('#chatArea').append('<span class="entry msg_'+chatMessage.type+' origin_'+chatMessage.origin+'">'+chatMessage.message+'<span class="dateMsg"><span class="dateDay">'+chatMessage.date.toLocaleDateString()+' </span><strong>'+chatMessage.date.toLocaleTimeString()+'</strong></span></span>');

	// Mise à jour du status lu
	chatMessage.read = true;

	// Animation de scroll en fin de liste des message
	var height = this.get('#chatArea')[0].scrollHeight;
	this.get('#chatArea').finish();		// Termine toutes les animations en cours (en cas d'affichage de messages en boucle ou très rapide)
	this.get('#chatArea').animate({ scrollTop: height }, 500);
};

/*
 * Affiche la popup de détail d'un utilisateur
 *		container : contenaire de la popup
 *		id : identifiant de l'utilisateur
 */
ChatUserInterface.prototype.showUserOptions = function(container, id) {
	var content = '';

	var user = ChatHandler.mainRoom.usersOnline[id];

	// Affichage standard
	content += '<div class="avatar">'+user.getAvatar(64)+'</div><div class="content"><span class="pseudo">'+user.pseudo+'</span><span class="rank">'+user.getRank()+'</span><span class="grade">'+user.getGrade()+'</span><div class="actions" data-id="'+user.id+'">';

	// Affichade des MP
	if(user.id != ChatHandler.myselfUser.id) content += '<span class="specAct" data-action="mp">MP</span>';

	// Affichage modérateur
	if(ChatHandler.myselfUser.rank > 0) {
		content += '<span class="specAct" data-action="kick">Kick</span><span class="specAct" data-action="ban">Ban</span>';
	}

	// Affichage administrateur
	if(ChatHandler.myselfUser.rank > 1) {
		if(user.rank == 2) {
			content += '<span class="specAct" data-action="remadmin">RemAdmin</span>';
		} else if(user.rank == 1) {
			content += '<span class="specAct" data-action="rempop">RemOP</span>';
		} else {
			content += '<span class="specAct" data-action="addop">AddOP</span><span class="specAct" data-action="addadmin">AddAdmin</span>';
		}
	}

	content += '</div></div>';

	container.html(content);
};

/*
 * Méthode d'affiche d'une salle de discussion
 *		room : salle de discussion à afficher
 */
ChatUserInterface.prototype.displayRoom = function(room) {
	// Effacement des messages
	this.cleanMessages();

	// Mise à jour de la liste des utilisateurs
	this.refreshUserList();

	// Mise à jours du titre du chat
	if(ChatHandler.rooms[room].isPrivate) {
		this.get('#titleBar').addClass('private');
		this.get('#title').html(ChatHandler.rooms[room].name+'<em> (en privé)</em>');
	} else {
		this.get('#titleBar').removeClass('private');
		this.get('#title').html(ChatHandler.rooms[room].name);
	}

	// Affichage de tout les messages enregistré de la salle
	ChatHandler.rooms[room].messages.forEach(function(element, index, array) {
		ChatHandler.UI.displayMessage(element);
	});

	// Mise à jour du nombre de messages privés en attente
	ChatHandler.updatePrivateMessages();
};

/*
 * Méthode d'affichage du sélecteur de discussions privées
 */
ChatUserInterface.prototype.showPrivateRooms = function() {
	// Destruction du sélecteur précédent
	this.hidePrivateRooms();

	// Création d'un nouveau sélecteur
	this.get('#roomSelection').prepend('<div id="privateRoomSelector"></div>');
	this.get('#privateRoomSelector').height(this.get('#chatArea').height()+'px');		// Ajustement de la hauteur du sélecteur

	// Ajout de chaque discussion privée
	ChatHandler.rooms.forEach(function(element, index, array) {
		if(element.privateChat) {
			var buf = '<span class="chatUser rank_'+ChatHandler.mainRoom.usersOnline[element.privateChat].rank+'" data-id="'+ChatHandler.mainRoom.usersOnline[element.privateChat].id+'"><span class="avatar">'+ChatHandler.mainRoom.usersOnline[element.privateChat].getAvatar(30);
			buf += '</span><span class="pseudo">'+ChatHandler.mainRoom.usersOnline[element.privateChat].pseudo+'<br /><span class="rank">'+ChatHandler.mainRoom.usersOnline[element.privateChat].getRank()+'</span></span></span>';
			this.get('#privateRoomSelector').append(buf);
		}
	});
};

/*
 * Méthode de destruction du sélecteur de discussion privée
 */
ChatUserInterface.prototype.hidePrivateRooms = function() {
	this.get('#privateRoomSelector').remove();
};

/*
 * Mise à jour du nombre de messages en attente dans les discussions privées
 *		nb : nombre de discussions privées
 */
ChatUserInterface.prototype.setPrivateUnread = function(nb) {
	this.get('#privateRoomsCounter').html(nb);
	if(nb>0) {
		this.get('#privateRoomsCounter').show();
	} else {
		this.get('#privateRoomsCounter').hide();
	}
};

/*
 * Mise à jour de l'icone de status du chat
 *		icon : nouvelle icon du chat (loading, offline, online, buzy)
 */
ChatUserInterface.prototype.setChatIcon = function(icon) {
	this.get('.statusBubble').removeClass('loading');
	this.get('.statusBubble').removeClass('offline');
	this.get('.statusBubble').removeClass('online');
	this.get('.statusBubble').removeClass('buzy');
	this.get('.statusBubble').addClass(icon);
};

/*
 * Affichage du panneau d'options
 */
ChatUserInterface.prototype.showOptions = function() {
	// Desactivation du chat
	ChatHandler.follow = false;

	// Nettoyage de l'affichage
	this.cleanMessages();
	this.cleanUsers();

	// Mise en place de la structure des options (menu, alpha, ...)
	this.get('#chatArea').append('<div id="chatAlpha"></div><div id="chatOptionsBar"></div><div id="chatOptionsContent"></div>');

	this.get('#chatAlpha').width(this.get('#mainLayout').width()+'px');
	this.get('#chatOptionsBar').width(this.get('#mainLayout').width()+'px');
	this.get('#chatOptionsContent').width(this.get('#mainLayout').width()+'px');

	this.get('#chatAlpha').height(this.get('#chatArea').height()+'px');
	this.get('#chatOptionsContent').width((this.get('#chatArea').width()-32)+'px');

	this.get('#chatOptionsBar').append('<span class="chatOpSwitch" id="op_messages"><span class="ic_pencil opIcon"></span><span class="opLbl">Conversations</span></span><span class="chatOpSwitch" id="op_sound"><span class="ic_sound opIcon"></span><span class="opLbl">Sons</span></span><span class="chatOpSwitch" id="op_auth"><span class="ic_keys opIcon"></span><span class="opLbl">Authentification</span></span>');

	// Mise à jour du titre du chat
	this.get('#title').html('Options');

	// Affiche par défaut les options sur les messages
	this.OptionsMessages();
};

/*
 * Affiche le panneau d'options du son
 */
ChatUserInterface.prototype.OptionsSounds = function() {
	// Mise à jour du menu d'options
	this.get('.chatOpSwitch').removeClass('active');
	this.get('#op_sound').addClass('active');

	// Affichage des options
	var content = '';
	content += '<div class="chatOption"><input class="chatOptionsChkbx" data-config="playSounds" type="checkbox"'+(ChatHandler.config.playSounds?' checked="checked"':'')+' /><label>Jouer les sons</label></div>';
	content += '<div class="chatOption"><input class="chatOptionsChkbx" data-config="playOnline" type="checkbox"'+(ChatHandler.config.playOnline?' checked="checked"':'')+' /><label>Notification lors qu\'un utilisateur entre dans le chat</label></div>';
	content += '<div class="chatOption"><input class="chatOptionsChkbx" data-config="playOffline" type="checkbox"'+(ChatHandler.config.playOffline?' checked="checked"':'')+' /><label>Notification lors qu\'un utilisateur quitte le chat</label></div>';
	content += '<div class="chatOption"><input class="chatOptionsChkbx" data-config="playHint" type="checkbox"'+(ChatHandler.config.playHint?' checked="checked"':'')+' /><label>Notification lors de la réception d\'un nouveau message</label></div>';
	content += '<div class="chatOption"><input class="chatOptionsChkbx" data-config="playOnlyPrivate" type="checkbox"'+(ChatHandler.config.playOnlyPrivate?' checked="checked"':'')+' /><label>Notifier uniquement les discussions privées</label></div>';
	this.get('#chatOptionsContent').html(content);
};

/*
 * Affiche le panneau d'options des messages
 */
ChatUserInterface.prototype.OptionsMessages = function() {
	// Mise à jour du menu d'options
	this.get('.chatOpSwitch').removeClass('active');
	this.get('#op_messages').addClass('active');

	// Affichage des options
	var content = '';
	content += '<div class="chatOption"><input class="chatOptionsChkbx" data-config="pseudoHighlight" type="checkbox"'+(ChatHandler.config.pseudoHighlight?' checked="checked"':'')+' /><label>Mettre mon pseudo en surbrillance dans les messages</label></div>';
	content += '<div class="chatOption"><input class="chatOptionsChkbx" data-config="privateAutoOpen" type="checkbox"'+(ChatHandler.config.privateAutoOpen?' checked="checked"':'')+' /><label>Ouvrir instentanément une conversation privée lors de la réception d\'un message privé</label></div>';
	content += '<div class="chatOption"><input class="chatOptionsChkbx" data-config="hideAutoMsg" type="checkbox"'+(ChatHandler.config.hideAutoMsg?' checked="checked"':'')+' /><label>Ne pas afficher les messages automatiques</label></div>';
	content += '<div class="chatOption"><input class="chatOptionsChkbx" data-config="hidePersoMsg" type="checkbox"'+(ChatHandler.config.hidePersoMsg?' checked="checked"':'')+' /><label>Ne pas afficher les messages personalisés</label></div>';
	content += '<div class="chatOption"><input class="chatOptionsChkbx" data-config="hideNotification" type="checkbox"'+(ChatHandler.config.hideNotification?' checked="checked"':'')+' /><label>Ne pas afficher les notifications</label></div>';
	this.get('#chatOptionsContent').html(content);
};

/*
 * Affiche le panneau d'options d'authentification
 */
ChatUserInterface.prototype.OptionsAuth = function() {
	// Mise à jour du menu d'options
	this.get('.chatOpSwitch').removeClass('active');
	this.get('#op_auth').addClass('active');

	// Affichage des options
	var content = '';
	content += '<div class="chatOption"><label>Identifiant</label><input type="text" id="chatAuthPseudo" value="'+(ChatHandler.authInfos?ChatHandler.authInfos.pseudo:'')+'"></div>';
	content += '<div class="chatOption"><label>Mot de passe</label><input type="password" id="chatAuthPassword" value=""></div>';
	content += '<div class="chatOption"><input id="chatAuthSavePseudo" type="checkbox"'+(ChatHandler.config.savePseudo?' checked="checked"':'')+' /><label>Retenir mon identifiant</label></div>';
	content += '<div class="chatOption"><input id="chatAuthAutoLogin" type="checkbox"'+(ChatHandler.config.autoLogin?' checked="checked"':'')+' /><label>Me connecter automatiquement</label></div>';
	content += '<div class="chatOption"><input id="chatAuthSubmit" type="button" value="Appliquer"></div>';
	this.get('#chatOptionsContent').html(content);
};

/*
 * Affiche une infobulle à la position de la souris
 *		message : message de l'infobulle
 */
ChatUserInterface.prototype.showTooltip = function(message) {
	// Destruction de l'ancien infobulle
	this.get('#EasyChatTooltip').finish();

	// Création de l'infobulle
	this.get('body').append('<div id="EasyChatTooltip">'+message+'</div>');

	// Mise à joru de la position
	this.get('#EasyChatTooltip').css('top', this.currentMousePos.y+16);
	this.get('#EasyChatTooltip').css('left', this.currentMousePos.x+16);

	// Evènement d'apparition
	this.get('#EasyChatTooltip').fadeIn('slow', function() {
		this.get('#EasyChatTooltip').css('top', ChatHandler.UI.currentMousePos.y+16);
		this.get('#EasyChatTooltip').css('left', ChatHandler.UI.currentMousePos.x+16);
	});
};

/*
 * Disparition de l'infobulle en cours
 */
ChatUserInterface.prototype.hideTooltip = function() {
	this.get('#EasyChatTooltip').fadeOut('fast', function() {
		this.get('#EasyChatTooltip').remove();
	});
};






//
//  Initialisation du chat
//

var ChatHandler = new ChatManager();
var Chat = new ChatAPI();


/*
 * Déclaration des fonctionnalités personnalisées du chat
 */

// Déclaration des rangs
Chat.addRank(0, 'Melinyen');
Chat.addRank(1, 'Modérateur');
Chat.addRank(2, 'Administrateur');

// Déclarations des rangs spéciaux
Chat.addSpecialRank(45, 'Le papa d\'EasyChat');
Chat.addSpecialRank(63, 'La maman d\'EasyChat');

// Définitnion du patern des avatars
Chat.setAvatarURLPatern('http://mon-serveur.com/avatars/##ID##.##FORMAT##');

// Déclaration des codes d'erreurs
Chat.addErrorCode(0, 'Commande non trouvée');
Chat.addErrorCode(1, 'Arguments manquants à la commande');
Chat.addErrorCode(2, 'Authentification failed');
Chat.addErrorCode(3, 'La commande CLIENT n\'a pas été exécutée');
Chat.addErrorCode(4, 'Version du protocole différente');
Chat.addErrorCode(5, 'Vous n\'avez pas les droits pour utiliser cette commande');
Chat.addErrorCode(6, 'L\'utilisateur est déjà OP/Admin');
Chat.addErrorCode(7, 'L\'utilisateur n\'est pas OP/Admin');
Chat.addErrorCode(8, 'Utilisateur déjà bannit');
Chat.addErrorCode(9, 'Utilisateur introuvable');
Chat.addErrorCode(10, 'Utilisateur banni');
Chat.addErrorCode(500, 'Erreur interne du serveur');


/*
 * Déclaration des commandes
 */

Chat.addCommand('help', 0, [], function(chatInstance, args) {
	var str = 'Liste des commandes disponibles :';

	for(var cmd in chatInstance.api.commands) {
		if(chatInstance.myselfUser.rank >= chatInstance.api.commands[cmd].rank) {
			str += '<br /><strong>'+cmd+'</strong>&nbsp;';
			for(var cargs in chatInstance.api.commands[cmd].params) {
				if(chatInstance.api.commands[cmd].params[cargs] === true) {
					str += 'message';
				} else {
					str += chatInstance.api.commands[cmd].params[cargs]+'&nbsp;';
				}
			}
		}
	}

	chatInstance.getActiveRoom().addMessage(Chat.SYSTEM_MESSAGE, Chat.CHAT_MESSAGE, str);
	return '';
});

Chat.addCommand('list', 0, [], function(chatInstance, args) {
	return 'LIST';
});

Chat.addCommand('version', 0, [], function(chatInstance, args) {
	chatInstance.UI.notification('Version du protocole : <strong>'+chatInstance.protocolVersion+'</strong> | Version du client : <strong>'+chatInstance.majorVersion+'.'+chatInstance.minorVersion+(chatInstance.patchVersion===0?'':'.'+chatInstance.patchVersion)+'</strong>');
	return '';
});

Chat.addCommand('login', 0, ['login', 'password'], function(chatInstance, args) {
	chatInstance.myself = args[0];
	return 'LOGIN ' + args.login + ' ' + md5(args.password);
});

Chat.addCommand('msg', 0, [true], function(chatInstance, args) {
	return 'MSG '+args.fusion;
});

Chat.addCommand('privmsg', 0, ['pseudo', true], function(chatInstance, args) {
	var userObj = chatInstance.mainRoom.getUserByName(args.pseudo);
	return 'PRIVMSG ' + userObj.pseudo + ' ' + args.fusion;
});

Chat.addCommand('whois', 0, ['pseudo'], function(chatInstance, args) {
	return 'WHOIS ' + args.pseudo;
});

Chat.addCommand('log', 0, [], function(chatInstance, args) {
	return 'LOG';
});

Chat.addCommand('kick', 1, ['pseudo', true], function(chatInstance, args) {
	return 'KICK ' + args.pseudo + ' ' + args.fusion;
});

Chat.addCommand('ban', 1, ['pseudo', true], function(chatInstance, args) {
	return 'BAN ' + args.pseudo + ' ' + args.fusion;
});

Chat.addCommand('unban', 1, ['pseudo'], function(chatInstance, args) {
	return 'UNBAN ' + args.pseudo;
});

Chat.addCommand('addop', 2, ['pseudo'], function(chatInstance, args) {
	return 'ADDOP ' + args.pseudo;
});

Chat.addCommand('remop', 2, ['pseudo'], function(chatInstance, args) {
	return 'REMOP ' + args.pseudo;
});

Chat.addCommand('addadmin', 2, ['pseudo'], function(chatInstance, args) {
	return 'ADDADMIN ' + args.pseudo;
});

Chat.addCommand('remadmin', 2, ['pseudo'], function(chatInstance, args) {
	return 'ADDADMIN ' + args.pseudo;
});



/*
 * Déclaration des réponses
 */

Chat.addResponse('MSG', ['user', true], function(chatInstance, args) {
    chatInstance.dialogLine(Chat.SERVER_MESSAGE, args.user, args.fusion, chatInstance.mainRoom.id);
    if(chatInstance.config.playSounds && chatInstance.config.playHint && !chatInstance.config.playOnlyPrivate && args.user!=chatInstance.myself) soundManager.play('hint');
});


Chat.addResponse('LIST', [['user', 'id', 'rank']], function(chatInstance, args) {
	chatInstance.mainRoom.usersOnline.forEach(function(element, index, array) {
		element.instances = 0;
	});

	args.forEach(function(element) {
		chatInstance.addUser(element.user, parseInt(element.id), parseInt(element.rank));
	});
});

Chat.addResponse('QUIT', [['user', 'id', 'rank']], function(chatInstance, args) {
	args.forEach(function(element) {
	    chatInstance.mainRoom.usersOnline[element.id].setOffline();
	    if(element.user == chatInstance.myself && element.instances === 0) {
	    	chatInstance.online = false;
	    	chatInstance.myselfUser = false;
	    }

	    if(!chatInstance.config.hideAutoMsg) {
		    if(!chatInstance.mainRoom.usersOnline[element.id].isOnline) chatInstance.mainRoom.addMessage(Chat.SERVER_MESSAGE, Chat.EVENT_MESSAGE, '<strong>'+element.user + ' a quitté la salle !</strong> '+chatInstance.localServer.getGoodbyeMessage());
		}

	});

	chatInstance.UI.refreshUserList();
	if(chatInstance.config.playSounds && !chatInstance.config.playOnlyPrivate && chatInstance.config.playOffline) soundManager.play('logout');
});

Chat.addResponse('JOIN', [['user', 'id', 'rank']], function(chatInstance, args) {
	args.forEach(function(element) {
	    if(!chatInstance.config.hideAutoMsg) {
		    if (typeof(chatInstance.mainRoom.usersOnline[element.id] == 'undefined') || !chatInstance.mainRoom.usersOnline[element.id].isOnline) {
		    	chatInstance.mainRoom.addMessage(Chat.SERVER_MESSAGE, Chat.EVENT_MESSAGE, '<strong>'+element.user + ' rejoint la salle !</strong> '+chatInstance.localServer.getWelcomeMessage());
		    }
		}
	    chatInstance.addUser(element.user, parseInt(element.id), parseInt(element.rank));
	    if(element.user.toLowerCase() == chatInstance.myself.toLowerCase()) {
	    	chatInstance.online = true;
	    	chatInstance.myselfUser = chatInstance.mainRoom.usersOnline[element.id];
	    }
	});

    if(chatInstance.config.playSounds && !chatInstance.config.playOnlyPrivate && chatInstance.config.playOnline) soundManager.play('login');
});

Chat.addResponse('ERROR', ['code', true], function(chatInstance, args) {
	chatInstance.getActiveRoom().addMessage(Chat.SERVER_MESSAGE, Chat.ERROR_MESSAGE, Chat.errorCode[args.code]);
});

Chat.addResponse('WHOIS', [['user', 'id', 'rank']], function(chatInstance, args) {

});

Chat.addResponse('PRIVMSG', ['user', true], function(chatInstance, args) {
    var currentRoom = chatInstance.getActiveRoom();
	var room = chatInstance.roomExists(args.user);

	if(!room) {
		var pr = chatInstance.addRoom(args.user, true).active();
		if(!chatInstance.config.privateAutoOpen) currentRoom.active();
		room = pr.id;
	}

    chatInstance.dialogLine(Chat.SERVER_MESSAGE, args.user, args.fusion, room);
    chatInstance.updatePrivateMessages();
    chatInstance.refheshPrivateUsers();

    if(chatInstance.config.playSounds && chatInstance.config.playHint && args.user!=chatInstance.myself) soundManager.play('hint');
});


/*
 * Déclaration des smileys
 */

Chat.addSmiley(':angel:', false, 'angel');
Chat.addSmiley(':arms:', false, 'arms');
Chat.addSmiley(':ban:', false, 'banned');
Chat.addSmiley(':grin:', false, 'biggrin');
Chat.addSmiley(':P', true, 'bleh');
Chat.addSmiley('Oo', true, 'blink');

Chat.addSmiley(':bye:', false, 'bye');
Chat.addSmiley(':kiss:', false, 'cheekkiss');
Chat.addSmiley(':^)', true, 'chin');
Chat.addSmiley(':cool:', false, 'cool');
Chat.addSmiley(':hard:', false, 'crutches');
Chat.addSmiley(';(', true, 'cry');

Chat.addSmiley('OO', true, 'drool');
Chat.addSmiley('-_-', true, 'dry');
Chat.addSmiley(':flowers:', false, 'flowers');
Chat.addSmiley(':no:', false, 'happyno');
Chat.addSmiley(':yes:', false, 'happyyes');
Chat.addSmiley(':hug:', false, 'hug');
Chat.addSmiley(':love:', false, 'huglove');

Chat.addSmiley(':knight:', false, 'knight');
Chat.addSmiley(':D', true, 'laugh');
Chat.addSmiley('lol', true,'lol');
Chat.addSmiley(':mad:', false, 'mad');
Chat.addSmiley(':|', true, 'mellow');
Chat.addSmiley(':omg:', false, 'ohmy');

Chat.addSmiley(':ouch:', false, 'ouch');
Chat.addSmiley(';|', true, 'rant');
Chat.addSmiley(':oo:', false, 'rolleyes');
Chat.addSmiley(':(', true, 'sad');
Chat.addSmiley(':shy:', false, 'shy');
Chat.addSmiley(':sick:', false, 'sick');

Chat.addSmiley(':facepalm:', false, 'slaphead');
Chat.addSmiley('zzz', true, 'sleep');
Chat.addSmiley(':)', true, 'smile');
Chat.addSmiley(':sweat:', false, 'sweat');
Chat.addSmiley(';(', true, 'tears');
Chat.addSmiley(':there:', false, 'therethere');

Chat.addSmiley(':up:', false, 'thumbup');
Chat.addSmiley(':p', true, 'tongue');
Chat.addSmiley(':fade:', false, 'ty');
Chat.addSmiley(':unsure:', false, 'unsure');
Chat.addSmiley(':welcome:', false, 'welcome');
Chat.addSmiley('??', true, 'what');

Chat.addSmiley(':wink:', false, 'wink');
Chat.addSmiley('gg', true, 'worthy');



/*
 *  Déclaration des évènements d'interface et de gestion du chat
 */

$(document).ready(function() {

	// Initialisation des sons
	soundManager.setup({
	  url: '/swf/',
	  flashVersion: 9,
	  onready: function() {
	    soundManager.createSound({
		  id: 'hint',
		  url: '/sounds/beep.mp3',
		  autoLoad: true,
		  autoPlay: false,
		  onload: function() {

		  },
		  volume: 50
		});

	    soundManager.createSound({
		  id: 'login',
		  url: '/sounds/Login.mp3',
		  autoLoad: true,
		  autoPlay: false,
		  onload: function() {

		  },
		  volume: 50
		});

	    soundManager.createSound({
		  id: 'logout',
		  url: '/sounds/Logout.mp3',
		  autoLoad: true,
		  autoPlay: false,
		  onload: function() {

		  },
		  volume: 50
		});
	  }
	});

	// Chargement de la configuration
	var config = getCookie('EasyChatConfig');
	if(config) ChatHandler.config = JSON.parse(config);

	// Initialisation du manager
	ChatHandler.init('easyChatContainer', Chat);
	ChatHandler.connect('ws://mon-serveur.com:8080');
	ChatHandler.saveConfig();


	// Evènement de soumission d'une commande (appuye sur entrée)
	ChatHandler.UI.get('#chatInput').keypress(function(event) {
		var key = event.keyCode || event.which;
		if(key == 13) ChatHandler.submitCommand();
	});

	// Mise à jour de la position de la souris (pour le positionnement des tooltips)
    $(document).mousemove(function(event) {
        ChatHandler.UI.currentMousePos.x = event.pageX;
        ChatHandler.UI.currentMousePos.y = event.pageY;
    });

    // Action au clic sur le sélecteur de la salle de discussion principale
	ChatHandler.UI.get('#roomsSwitch').click(function() {
		ChatHandler.mainRoom.active();
		ChatHandler.UI.displayRoom(ChatHandler.mainRoom.id);
	});

	// Action au clic sur le sélecteur de discussions privées
	ChatHandler.UI.get('#privateRoomsSwitch').click(function() {
		ChatHandler.UI.showPrivateRooms();
	});

	// Action au clic sur le bouton "Envoyer"
	ChatHandler.UI.get('#sendBtn').click(function() {
		ChatHandler.submitCommand();
	});

	// Action au clic sur le bouton de redimentionnement
	ChatHandler.UI.get('#sizeToggle').click(function() {
		$(this).toggleClass('ic_sizeDown');
		$(this).toggleClass('ic_sizeUp');
		ChatHandler.UI.get('#corpus').slideToggle();
	});

	// Action au clic sur le boutons des logs
	ChatHandler.UI.get('#logSwitch').click(function() {
		ChatHandler.UI.showLogs();
	});

	// Action au clic sur le bouton des options
	ChatHandler.UI.get('#configBtn').click(function() {
		ChatHandler.UI.showOptions();
	});

	// Gestion des actions des boutons des poopups de détail des utilisateurs
	ChatHandler.UI.get('.specAct').click(function() {
		switch($(this).data('action')) {
			case 'mp':
				ChatHandler.switchPrivateRoom($(this).parent().data('id'));
				break;
			case 'kick':
				ChatHandler.command('/kick '+(ChatHandler.mainRoom.usersOnline[$(this).parent().data('id')].pseudo));
				break;
			case 'ban':
				ChatHandler.command('/ban '+(ChatHandler.mainRoom.usersOnline[$(this).parent().data('id')].pseudo));
				break;
			case 'addop':
				ChatHandler.command('/addop '+(ChatHandler.mainRoom.usersOnline[$(this).parent().data('id')].pseudo));
				break;
			case 'addadmin':
				ChatHandler.command('/addadmin '+(ChatHandler.mainRoom.usersOnline[$(this).parent().data('id')].pseudo));
				break;
			case 'remop':
				ChatHandler.command('/remop '+(ChatHandler.mainRoom.usersOnline[$(this).parent().data('id')].pseudo));
				break;
			case 'remadmin':
				ChatHandler.command('/remadmin '+(ChatHandler.mainRoom.usersOnline[$(this).parent().data('id')].pseudo));
				break;
			default:
				break;
		}
	});

	// Action au clic sur un utilisateur de la liste
	$(document).on('click', '.chatUser', function() {
		ChatHandler.switchPrivateRoom($(this).data('id'));
	});

	// Action au clic sur le bouton des options sonores
	$(document).on('click', '#op_sound', function() {
		ChatHandler.UI.OptionsSounds();
	});

	// Action au clic sur le bouton des options messages
	$(document).on('click', '#op_messages', function() {
		ChatHandler.UI.OptionsMessages();
	});

	// Action au clic sur le bouton des options d'authentification
	$(document).on('click', '#op_auth', function() {
		ChatHandler.UI.OptionsAuth();
	});

	// Action au clic sur le pseudo d'un utilisateur dans les messages
	$(document).on('click', '.sender', function() {
	    $('.dropdown').hide();
	    $('.dropdown').empty();

		$(this).find('.dropdown').toggle();
		ChatHandler.UI.showUserOptions($(this).find('.dropdown'), $(this).data('id'));
	});

	// Actions de fermeture automatique lors d'un clic extérieur à une zone
	$(document).mouseup(function(e) {
	    var container = $('.sender');
	    if (!container.is(e.target) && container.has(e.target).length === 0) {
	    	$('.dropdown').hide();
	    	$('.dropdown').empty();
	    }

	    container = $('#privateRoomSelector');
	    if (!container.is(e.target) && container.has(e.target).length === 0) {
	    	ChatHandler.UI.hidePrivateRooms();
	    }
	});

	// Rollover sur les boutons des options
	$(document).on('mouseenter', '.chatOpSwitch', function() {
		$(this).find('.opIcon').addClass('active');
	});

	// Rollout sur les boutons des options
	$(document).on('mouseleave', '.chatOpSwitch', function() {
		$(this).find('.opIcon').removeClass('active');
	});

	// Action au clic sur la souission de l'authentification
	$(document).on('click', '#chatAuthSubmit', function() {
		if(ChatHandler.UI.get('#chatAuthPseudo').val() !== '') {
			if(ChatHandler.UI.get('#chatAuthSavePseudo').is(':checked') || ChatHandler.UI.get('#chatAuthAutoLogin').is(':checked')) {
				var auth = {
					pseudo: ChatHandler.UI.get('#chatAuthPseudo').val()
				};
				if(ChatHandler.UI.get('#chatAuthAutoLogin').is(':checked')) auth.password = md5(ChatHandler.UI.get('#chatAuthPassword').val());

				setCookie('EasyChatAuth', JSON.stringify(auth), 7);

				ChatHandler.config.savePseudo = ChatHandler.UI.get('#chatAuthSavePseudo').is(':checked');
				ChatHandler.config.autoLogin = ChatHandler.UI.get('#chatAuthAutoLogin').is(':checked');
				ChatHandler.saveConfig();
			}
			ChatHandler.login(ChatHandler.UI.get('#chatAuthPseudo').val(), ChatHandler.UI.get('#chatAuthPassword').val());
			ChatHandler.UI.displayRoom(ChatHandler.mainRoom.id);
		}
	});

	// Action lors du clic sur une coche des options
	$(document).on('click', '.chatOptionsChkbx', function() {
		ChatHandler.config[$(this).data('config')] = $(this).is(':checked');
		ChatHandler.saveConfig();
	});

	/*
	 * Tooltips
	 */

	$(document).on('mouseenter', '#roomsSwitch', function() {
		ChatHandler.UI.showTooltip('Afficher le chat principal');
	});

	$(document).on('mouseleave', '#roomsSwitch', function() {
		ChatHandler.UI.hideTooltip();
	});

	$(document).on('mouseenter', '#privateRoomsSwitch', function() {
		ChatHandler.UI.showTooltip('Sélectionner une conversation privée');
	});

	$(document).on('mouseleave', '#privateRoomsSwitch', function() {
		ChatHandler.UI.hideTooltip();
	});

	$(document).on('mouseenter', '#logSwitch', function() {
		ChatHandler.UI.showTooltip('Afficher le dialogue serveur');
	});

	$(document).on('mouseleave', '#logSwitch', function() {
		ChatHandler.UI.hideTooltip();
	});
});

// Intervale de mise à jour du client
setInterval(function() {
	ChatHandler.update();
}, 60000);




/*
 *
 *   Fonctions utiles
 *
 */


function htmlentities(string, quote_style, charset, double_encode) {
  var hash_map = this.get_html_translation_table('HTML_ENTITIES', quote_style),
    symbol = '';
  string = string === null ? '' : string + '';

  if (!hash_map) {
    return false;
  }

  if (quote_style && quote_style === 'ENT_QUOTES') {
    hash_map["'"] = '&#039;';
  }

  if ( !! double_encode || double_encode === null) {
    for (symbol in hash_map) {
      if (hash_map.hasOwnProperty(symbol)) {
        string = string.split(symbol)
          .join(hash_map[symbol]);
      }
    }
  } else {
    string = string.replace(/([\s\S]*?)(&(?:#\d+|#x[\da-f]+|[a-zA-Z][\da-z]*);|$)/g, function(ignore, text, entity) {
      for (symbol in hash_map) {
        if (hash_map.hasOwnProperty(symbol)) {
          text = text.split(symbol)
            .join(hash_map[symbol]);
        }
      }

      return text + entity;
    });
  }

  return string;
}

function get_html_translation_table(table, quote_style) {
  var entities = {},
    hash_map = {},
    decimal;
  var constMappingTable = {},
    constMappingQuoteStyle = {};
  var useTable = {},
    useQuoteStyle = {};

  // Translate arguments
  constMappingTable[0] = 'HTML_SPECIALCHARS';
  constMappingTable[1] = 'HTML_ENTITIES';
  constMappingQuoteStyle[0] = 'ENT_NOQUOTES';
  constMappingQuoteStyle[2] = 'ENT_COMPAT';
  constMappingQuoteStyle[3] = 'ENT_QUOTES';

  useTable = !isNaN(table) ? constMappingTable[table] : table ? table.toUpperCase() : 'HTML_SPECIALCHARS';
  useQuoteStyle = !isNaN(quote_style) ? constMappingQuoteStyle[quote_style] : quote_style ? quote_style.toUpperCase() :
    'ENT_COMPAT';

  if (useTable !== 'HTML_SPECIALCHARS' && useTable !== 'HTML_ENTITIES') {
    throw new Error('Table: ' + useTable + ' not supported');
    // return false;
  }

  entities['38'] = '&amp;';
  if (useTable === 'HTML_ENTITIES') {
    entities['160'] = '&nbsp;';
    entities['161'] = '&iexcl;';
    entities['162'] = '&cent;';
    entities['163'] = '&pound;';
    entities['164'] = '&curren;';
    entities['165'] = '&yen;';
    entities['166'] = '&brvbar;';
    entities['167'] = '&sect;';
    entities['168'] = '&uml;';
    entities['169'] = '&copy;';
    entities['170'] = '&ordf;';
    entities['171'] = '&laquo;';
    entities['172'] = '&not;';
    entities['173'] = '&shy;';
    entities['174'] = '&reg;';
    entities['175'] = '&macr;';
    entities['176'] = '&deg;';
    entities['177'] = '&plusmn;';
    entities['178'] = '&sup2;';
    entities['179'] = '&sup3;';
    entities['180'] = '&acute;';
    entities['181'] = '&micro;';
    entities['182'] = '&para;';
    entities['183'] = '&middot;';
    entities['184'] = '&cedil;';
    entities['185'] = '&sup1;';
    entities['186'] = '&ordm;';
    entities['187'] = '&raquo;';
    entities['188'] = '&frac14;';
    entities['189'] = '&frac12;';
    entities['190'] = '&frac34;';
    entities['191'] = '&iquest;';
    entities['192'] = '&Agrave;';
    entities['193'] = '&Aacute;';
    entities['194'] = '&Acirc;';
    entities['195'] = '&Atilde;';
    entities['196'] = '&Auml;';
    entities['197'] = '&Aring;';
    entities['198'] = '&AElig;';
    entities['199'] = '&Ccedil;';
    entities['200'] = '&Egrave;';
    entities['201'] = '&Eacute;';
    entities['202'] = '&Ecirc;';
    entities['203'] = '&Euml;';
    entities['204'] = '&Igrave;';
    entities['205'] = '&Iacute;';
    entities['206'] = '&Icirc;';
    entities['207'] = '&Iuml;';
    entities['208'] = '&ETH;';
    entities['209'] = '&Ntilde;';
    entities['210'] = '&Ograve;';
    entities['211'] = '&Oacute;';
    entities['212'] = '&Ocirc;';
    entities['213'] = '&Otilde;';
    entities['214'] = '&Ouml;';
    entities['215'] = '&times;';
    entities['216'] = '&Oslash;';
    entities['217'] = '&Ugrave;';
    entities['218'] = '&Uacute;';
    entities['219'] = '&Ucirc;';
    entities['220'] = '&Uuml;';
    entities['221'] = '&Yacute;';
    entities['222'] = '&THORN;';
    entities['223'] = '&szlig;';
    entities['224'] = '&agrave;';
    entities['225'] = '&aacute;';
    entities['226'] = '&acirc;';
    entities['227'] = '&atilde;';
    entities['228'] = '&auml;';
    entities['229'] = '&aring;';
    entities['230'] = '&aelig;';
    entities['231'] = '&ccedil;';
    entities['232'] = '&egrave;';
    entities['233'] = '&eacute;';
    entities['234'] = '&ecirc;';
    entities['235'] = '&euml;';
    entities['236'] = '&igrave;';
    entities['237'] = '&iacute;';
    entities['238'] = '&icirc;';
    entities['239'] = '&iuml;';
    entities['240'] = '&eth;';
    entities['241'] = '&ntilde;';
    entities['242'] = '&ograve;';
    entities['243'] = '&oacute;';
    entities['244'] = '&ocirc;';
    entities['245'] = '&otilde;';
    entities['246'] = '&ouml;';
    entities['247'] = '&divide;';
    entities['248'] = '&oslash;';
    entities['249'] = '&ugrave;';
    entities['250'] = '&uacute;';
    entities['251'] = '&ucirc;';
    entities['252'] = '&uuml;';
    entities['253'] = '&yacute;';
    entities['254'] = '&thorn;';
    entities['255'] = '&yuml;';
  }

  if (useQuoteStyle !== 'ENT_NOQUOTES') {
    entities['34'] = '&quot;';
  }
  if (useQuoteStyle === 'ENT_QUOTES') {
    entities['39'] = '&#39;';
  }
  entities['60'] = '&lt;';
  entities['62'] = '&gt;';

  // ascii decimals to real symbols
  for (decimal in entities) {
    if (entities.hasOwnProperty(decimal)) {
      hash_map[String.fromCharCode(decimal)] = entities[decimal];
    }
  }

  return hash_map;
}

function linkify(text){
    if (text) {
        text = text.replace(
            /((https?\:\/\/)|(www\.))(\S+)(\w{2,4})(:[0-9]+)?(\/|\/([\w#!:.?+=&%@!\-\/]))?/gi,
            function(url){
                var full_url = url;
                if (!full_url.match('^https?:\/\/')) {
                    full_url = 'http://' + full_url;
                }
                if(url.length > 50) {
                  url = url.substr(0,50) + '...';
                }
                return '<a href="' + full_url + '" target="_blank">' + url + '</a>';
            }
        );
    }
    return text;
}

function setCookie(name,value,days)
{
  var expire=new Date();
  expire.setDate(expire.getDate()+days);
  document.cookie=name+'='+escape(value)+';expires='+expire.toGMTString();
  return true;
}

function getCookie(name)
{
  if(document.cookie.length>0)
  {
    var start=document.cookie.indexOf(name+"=");
    var pos = start+name.length+1;
    if(start!==0)
    {
      start=document.cookie.indexOf("; "+name+"=");
      pos = start+name.length+3;
    }
    if(start!=-1)
    {
      start=pos;
      var end=document.cookie.indexOf(";",start);
      if(end==-1)
      {
        end=document.cookie.length;
      }
    return unescape(document.cookie.substring(start,end));
    }
  }
  return false;
}


function rescape(text) {
  return text.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, "\\$&");
}

function htmlspecialchars(string, quote_style, charset, double_encode) {
  var optTemp = 0,
    i = 0,
    noquotes = false;
  if (typeof quote_style === 'undefined' || quote_style === null) {
    quote_style = 2;
  }
  string = string.toString();
  if (double_encode !== false) { // Put this first to avoid double-encoding
    string = string.replace(/&/g, '&amp;');
  }
  string = string.replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  var OPTS = {
    'ENT_NOQUOTES': 0,
    'ENT_HTML_QUOTE_SINGLE': 1,
    'ENT_HTML_QUOTE_DOUBLE': 2,
    'ENT_COMPAT': 2,
    'ENT_QUOTES': 3,
    'ENT_IGNORE': 4
  };
  if (quote_style === 0) {
    noquotes = true;
  }
  if (typeof quote_style !== 'number') { // Allow for a single string or an array of string flags
    quote_style = [].concat(quote_style);
    for (i = 0; i < quote_style.length; i++) {
      // Resolve string input to bitwise e.g. 'ENT_IGNORE' becomes 4
      if (OPTS[quote_style[i]] === 0) {
        noquotes = true;
      } else if (OPTS[quote_style[i]]) {
        optTemp = optTemp | OPTS[quote_style[i]];
      }
    }
    quote_style = optTemp;
  }
  if (quote_style & OPTS.ENT_HTML_QUOTE_SINGLE) {
    string = string.replace(/'/g, '&#039;');
  }
  if (!noquotes) {
    string = string.replace(/"/g, '&quot;');
  }

  return string;
}


function getId(id) {
    return !id || id.nodeType === 1 ? id : document.getElementById(id);
}

function isType(o,t) {
  return (typeof o).indexOf(t.charAt(0).toLowerCase()) === 0;
}


function image(src,cfg) {
  var img, prop, target;
    cfg = cfg || (isType(src,'o') ? src : {});

    img = getId(src);
    if (img) {
        src = cfg.src || img.src;
    } else {
        img = document.createElement('img');
        src = src || cfg.src;
    }

    if (!src) {
        return null;
    }

    prop = isType(img.naturalWidth,'u') ? 'width' : 'naturalWidth';
    img.alt = cfg.alt || img.alt;

    img.src = src;

    target = getId(cfg.target);
    if (target) {
        target.insertBefore(img, getId(cfg.insertBefore) || null);
    }

    // Loaded?
    if (img.complete) {
        if (img[prop]) {
            if (isType(cfg.success,'f')) {
                cfg.success.call(img);
            }
        } else {
            if (isType(cfg.failure,'f')) {
                cfg.failure.call(img);
            }
        }
    } else {
        if (isType(cfg.success,'f')) {
            img.onload = cfg.success;
        }
        if (isType(cfg.failure,'f')) {
            img.onerror = cfg.failure;
        }
    }

    return img;
}


var md5=(function(){function e(e,t){var o=e[0],u=e[1],a=e[2],f=e[3];o=n(o,u,a,f,t[0],7,-680876936);f=n(f,o,u,a,t[1],
12,-389564586);a=n(a,f,o,u,t[2],17,606105819);u=n(u,a,f,o,t[3],22,-1044525330);o=n(o,u,a,f,t[4],7,-176418897);f=n(f,o,u,a,t[5],
12,1200080426);a=n(a,f,o,u,t[6],17,-1473231341);u=n(u,a,f,o,t[7],22,-45705983);o=n(o,u,a,f,t[8],7,1770035416);f=n(f,o,u,a,t[9],
12,-1958414417);a=n(a,f,o,u,t[10],17,-42063);u=n(u,a,f,o,t[11],22,-1990404162);o=n(o,u,a,f,t[12],7,1804603682);f=n(f,o,u,a,t[13],
12,-40341101);a=n(a,f,o,u,t[14],17,-1502002290);u=n(u,a,f,o,t[15],22,1236535329);o=r(o,u,a,f,t[1],5,-165796510);f=r(f,o,u,a,t[6],
9,-1069501632);a=r(a,f,o,u,t[11],14,643717713);u=r(u,a,f,o,t[0],20,-373897302);o=r(o,u,a,f,t[5],5,-701558691);f=r(f,o,u,a,t[10],
9,38016083);a=r(a,f,o,u,t[15],14,-660478335);u=r(u,a,f,o,t[4],20,-405537848);o=r(o,u,a,f,t[9],5,568446438);f=r(f,o,u,a,t[14],
9,-1019803690);a=r(a,f,o,u,t[3],14,-187363961);u=r(u,a,f,o,t[8],20,1163531501);o=r(o,u,a,f,t[13],5,-1444681467);f=r(f,o,u,a,t[2],
9,-51403784);a=r(a,f,o,u,t[7],14,1735328473);u=r(u,a,f,o,t[12],20,-1926607734);o=i(o,u,a,f,t[5],4,-378558);f=i(f,o,u,a,t[8],
11,-2022574463);a=i(a,f,o,u,t[11],16,1839030562);u=i(u,a,f,o,t[14],23,-35309556);o=i(o,u,a,f,t[1],4,-1530992060);f=i(f,o,u,a,t[4],
11,1272893353);a=i(a,f,o,u,t[7],16,-155497632);u=i(u,a,f,o,t[10],23,-1094730640);o=i(o,u,a,f,t[13],4,681279174);f=i(f,o,u,a,t[0],
11,-358537222);a=i(a,f,o,u,t[3],16,-722521979);u=i(u,a,f,o,t[6],23,76029189);o=i(o,u,a,f,t[9],4,-640364487);f=i(f,o,u,a,t[12],
11,-421815835);a=i(a,f,o,u,t[15],16,530742520);u=i(u,a,f,o,t[2],23,-995338651);o=s(o,u,a,f,t[0],6,-198630844);f=s(f,o,u,a,t[7],
10,1126891415);a=s(a,f,o,u,t[14],15,-1416354905);u=s(u,a,f,o,t[5],21,-57434055);o=s(o,u,a,f,t[12],6,1700485571);f=s(f,o,u,a,t[3],
10,-1894986606);a=s(a,f,o,u,t[10],15,-1051523);u=s(u,a,f,o,t[1],21,-2054922799);o=s(o,u,a,f,t[8],6,1873313359);f=s(f,o,u,a,t[15],
10,-30611744);a=s(a,f,o,u,t[6],15,-1560198380);u=s(u,a,f,o,t[13],21,1309151649);o=s(o,u,a,f,t[4],6,-145523070);f=s(f,o,u,a,t[11],
10,-1120210379);a=s(a,f,o,u,t[2],15,718787259);u=s(u,a,f,o,t[9],21,-343485551);e[0]=m(o,e[0]);e[1]=m(u,e[1]);e[2]=m(a,e[2]);e[3]=m(f,e[3])}
function t(e,t,n,r,i,s){t=m(m(t,e),m(r,s));return m(t<<i|t>>>32-i,n)}function n(e,n,r,i,s,o,u){return t(n&r|~n&i,e,n,s,o,u)}
function r(e,n,r,i,s,o,u){return t(n&i|r&~i,e,n,s,o,u)}function i(e,n,r,i,s,o,u){return t(n^r^i,e,n,s,o,u)}
function s(e,n,r,i,s,o,u){return t(r^(n|~i),e,n,s,o,u)}function o(t){var n=t.length,r=[1732584193,-271733879,-1732584194,271733878],i;
for(i=64;i<=t.length;i+=64){e(r,u(t.substring(i-64,i)))}t=t.substring(i-64);var s=[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0];
for(i=0;i<t.length;i++)s[i>>2]|=t.charCodeAt(i)<<(i%4<<3);s[i>>2]|=128<<(i%4<<3);if(i>55){e(r,s);for(i=0;i<16;i++)s[i]=0}s[14]=n*8;e(r,s);return r}
function u(e){var t=[],n;for(n=0;n<64;n+=4){t[n>>2]=e.charCodeAt(n)+(e.charCodeAt(n+1)<<8)+(e.charCodeAt(n+2)<<16)+(e.charCodeAt(n+3)<<24)}return t}
function c(e){var t="",n=0;for(;n<4;n++)t+=a[e>>n*8+4&15]+a[e>>n*8&15];return t}
function h(e){for(var t=0;t<e.length;t++)e[t]=c(e[t]);return e.join("")}
function d(e){return h(o(unescape(encodeURIComponent(e))))}
function m(e,t){return e+t&4294967295}var a="0123456789abcdef".split("");return d})();
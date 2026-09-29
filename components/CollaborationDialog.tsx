import React, { useState, useEffect, useRef } from 'react';
import { 
  Users, Copy, X, CheckCircle, Wifi, WifiOff,
  QrCode, Camera, ShieldCheck, Share2, ArrowRightLeft, Info, RefreshCw, Settings2, ImageUp
} from 'lucide-react';
import QRCode from 'qrcode';
import jsQR from 'jsqr';
import type * as Y from 'yjs';
import {
  consumeSeed,
  DEFAULT_COLLAB_CONFIG,
  formatCode,
  formatTransferCode,
  generatePassword,
  generateRoomCode,
  generateTransferCode,
  getLiveState,
  isValidPassword,
  isValidRoomCode,
  isValidTurnUrl,
  loadCollabConfig,
  parseSignalingList,
  parseTransferCode,
  randomUserColor,
  saveCollabConfig,
  startLiveSession,
  startTransferReceive,
  startTransferSend,
  stopLiveSession,
  transferQrPayload,
  updateLiveUser,
  useLiveSession,
  USER_COLORS,
  type CollabConfig,
  type TransferCode,
  type TransferHandle,
} from '../utils/collaboration';
import { LanguageCode, t } from '../utils/translations';
import { useApp } from '../AppContext';
import { useEscapeKey, useFocusTrap } from '../utils/hooks';
import { prepareHtmlForEditor } from '../editor/sanitize';
import type { DocumentData } from '../types';
import '../editor/extensions/collab'; // registers the collaboration extensions

const LOCALIZED_P2P: Record<string, Record<string, string>> = {
  'en-US': {
    title: 'P2P Share & Sync',
    e2eeTransfer: 'End-to-End Encrypted (E2EE) Transfer',
    liveCollaboration: 'Live Collaboration',
    directQrClone: 'Direct QR Clone',
    startE2eeSession: 'Start E2EE Sync Session',
    createsCollaborative: 'Creates a collaborative WebRTC secure room',
    joinPeerSession: 'Join Peer Session',
    enterRoomCodeE2ee: 'Enter a room code & E2EE key to collaborate',
    directP2p: 'Direct Peer-to-Peer',
    p2pDescription: 'Edits travel directly between devices over encrypted WebRTC. The signaling server only relays password-encrypted connection offers — it never receives your document.',
    roomCode: 'Room Code',
    e2eePassword: 'E2EE Password Key',
    joinRoom: 'Join Room',
    back: 'Back',
    syncRoomDetails: 'Sync Room Details',
    copyCredentials: 'Copy Credentials',
    connectedLive: 'Connected live',
    connectingToSignaling: 'Connecting to signaling network...',
    peersInChannel: 'peer(s) in channel',
    connectedPeers: 'Connected Peers',
    disconnectStop: 'Disconnect & Stop Live Session',
    transferDirectly: 'Copy a document to another device: scan the QR code or type the transfer code. The copy travels directly over encrypted WebRTC; a signaling server only introduces the devices.',
    sendDocument: 'Send Document',
    generateSharingQr: 'Generate sharing QR',
    scanImport: 'Scan & Import',
    openCamera: 'Open device camera',
    scanThisQr: 'Scan this QR Code on the receiving device',
    waitingForPeer: 'Waiting for peer to scan and connect...',
    cancelShare: 'Cancel Share',
    pointCamera: 'Point your camera at the sender\'s screen',
    cameraAccessError: 'Could not access camera feed. Please check permissions or upload a QR image.',
    cancelScanner: 'Cancel Scanner',
    synchronizingDoc: 'Synchronizing Document...',
    exchangingKeys: 'Connecting over an encrypted WebRTC channel',
    transferCompleted: 'Transfer Completed Successfully!',
    e2eeSecured: 'The copy was saved as a new document on this device.',
    done: 'Done'
  },
  'es': {
    title: 'Compartir y Sincronizar P2P',
    e2eeTransfer: 'Transferencia cifrada de extremo a extremo (E2EE)',
    liveCollaboration: 'Colaboración en vivo',
    directQrClone: 'Clonación directa por QR',
    startE2eeSession: 'Iniciar sesión de sincronización E2EE',
    createsCollaborative: 'Crea una sala colaborativa segura de WebRTC',
    joinPeerSession: 'Unirse a la sesión de pares',
    enterRoomCodeE2ee: 'Ingresa un código de sala y clave E2EE para colaborar',
    directP2p: 'Peer-to-Peer Directo',
    p2pDescription: 'Las ediciones viajan directamente entre dispositivos por WebRTC cifrado. El servidor de señalización solo retransmite ofertas de conexión cifradas con la contraseña; nunca recibe tu documento.',
    roomCode: 'Código de sala',
    e2eePassword: 'Clave de contraseña E2EE',
    joinRoom: 'Unirse a la sala',
    back: 'Volver',
    syncRoomDetails: 'Detalles de la sala de sincronización',
    copyCredentials: 'Copiar credenciales',
    connectedLive: 'Conectado en vivo',
    connectingToSignaling: 'Conectando a la red de señalización...',
    peersInChannel: 'par(es) en el canal',
    connectedPeers: 'Pares conectados',
    disconnectStop: 'Desconectar y detener sesión en vivo',
    transferDirectly: 'Copia un documento a otro dispositivo: escanea el código QR o escribe el código de transferencia. La copia viaja directamente por WebRTC cifrado; un servidor de señalización solo presenta los dispositivos.',
    sendDocument: 'Enviar documento',
    generateSharingQr: 'Generar QR de compartir',
    scanImport: 'Escanear e importar',
    openCamera: 'Abrir cámara del dispositivo',
    scanThisQr: 'Escanea este código QR en el dispositivo receptor',
    waitingForPeer: 'Esperando a que el par escanee y se conecte...',
    cancelShare: 'Cancelar compartir',
    pointCamera: 'Apunta tu cámara a la pantalla del remitente',
    cameraAccessError: 'No se pudo acceder a la cámara. Revisa los permisos o sube una imagen QR.',
    cancelScanner: 'Cancelar escáner',
    synchronizingDoc: 'Sincronizando documento...',
    exchangingKeys: 'Conectando por un canal WebRTC cifrado',
    transferCompleted: '¡Transferencia completada con éxito!',
    e2eeSecured: 'La copia se guardó como un documento nuevo en este dispositivo.',
    done: 'Listo'
  },
  'fr': {
    title: 'Partage & Synchro P2P',
    e2eeTransfer: 'Transfert chiffré de bout en bout (E2EE)',
    liveCollaboration: 'Collaboration en direct',
    directQrClone: 'Clone QR direct',
    startE2eeSession: 'Démarrer session synchro E2EE',
    createsCollaborative: 'Crée une salle collaborative sécurisée WebRTC',
    joinPeerSession: 'Rejoindre une session',
    enterRoomCodeE2ee: 'Entrez un code de salon et clé E2EE pour collaborer',
    directP2p: 'Peer-to-Peer Direct',
    p2pDescription: 'Les modifications circulent directement entre appareils via WebRTC chiffré. Le serveur de signalisation ne relaie que des offres de connexion chiffrées par le mot de passe ; il ne reçoit jamais votre document.',
    roomCode: 'Code de salon',
    e2eePassword: 'Clé de mot de passe E2EE',
    joinRoom: 'Rejoindre le salon',
    back: 'Retour',
    syncRoomDetails: 'Détails du salon de synchro',
    copyCredentials: 'Copier les identifiants',
    connectedLive: 'Connecté en direct',
    connectingToSignaling: 'Connexion au réseau de signalisation...',
    peersInChannel: 'pair(s) dans le salon',
    connectedPeers: 'Pairs connectés',
    disconnectStop: 'Déconnecter & Arrêter le direct',
    transferDirectly: 'Copiez un document vers un autre appareil : scannez le QR code ou saisissez le code de transfert. La copie circule directement via WebRTC chiffré ; un serveur de signalisation ne fait que mettre les appareils en relation.',
    sendDocument: 'Envoyer le document',
    generateSharingQr: 'Générer le QR de partage',
    scanImport: 'Scanner & Importer',
    openCamera: 'Ouvrir la caméra de l\'appareil',
    scanThisQr: 'Scannez ce code QR sur l\'appareil récepteur',
    waitingForPeer: 'Attente du scan et de la connexion du pair...',
    cancelShare: 'Annuler le partage',
    pointCamera: 'Pointez votre caméra vers l\'écran de l\'expéditeur',
    cameraAccessError: 'Impossible d\'accéder à la caméra. Vérifiez les permissions.',
    cancelScanner: 'Annuler le scanner',
    synchronizingDoc: 'Synchronisation du document...',
    exchangingKeys: 'Connexion via un canal WebRTC chiffré',
    transferCompleted: 'Transfert réussi !',
    e2eeSecured: 'La copie a été enregistrée comme nouveau document sur cet appareil.',
    done: 'Terminé'
  },
  'de': {
    title: 'P2P Teilen & Synch',
    e2eeTransfer: 'Ende-zu-Ende verschlüsselte (E2EE) Übertragung',
    liveCollaboration: 'Live-Zusammenarbeit',
    directQrClone: 'Direkter QR-Klon',
    startE2eeSession: 'E2EE-Synch-Sitzung starten',
    createsCollaborative: 'Erstellt einen kollaborativen sicheren WebRTC-Raum',
    joinPeerSession: 'Sitzung beitreten',
    enterRoomCodeE2ee: 'Raumcode & E2EE-Schlüssel eingeben',
    directP2p: 'Direktes Peer-to-Peer',
    p2pDescription: 'Änderungen werden direkt zwischen Geräten über verschlüsseltes WebRTC übertragen. Der Signalisierungsserver leitet nur passwortverschlüsselte Verbindungsangebote weiter und erhält nie Ihr Dokument.',
    roomCode: 'Raumcode',
    e2eePassword: 'E2EE-Passwortschlüssel',
    joinRoom: 'Raum beitreten',
    back: 'Zurück',
    syncRoomDetails: 'Synch-Raumdetails',
    copyCredentials: 'Anmeldedaten kopieren',
    connectedLive: 'Live verbunden',
    connectingToSignaling: 'Verbindung zum Signalnetzwerk wird hergestellt...',
    peersInChannel: 'Partner im Kanal',
    connectedPeers: 'Verbundene Partner',
    disconnectStop: 'Trennen & Live-Sitzung beenden',
    transferDirectly: 'Kopieren Sie ein Dokument auf ein anderes Gerät: QR-Code scannen oder Übertragungscode eingeben. Die Kopie wird direkt über verschlüsseltes WebRTC übertragen; ein Signalisierungsserver stellt nur die Verbindung her.',
    sendDocument: 'Dokument senden',
    generateSharingQr: 'Freigabe-QR generieren',
    scanImport: 'Scannen & Importieren',
    openCamera: 'Gerätekamera öffnen',
    scanThisQr: 'Scannen Sie diesen QR-Code auf dem Empfängergerät',
    waitingForPeer: 'Warten auf Verbindung...',
    cancelShare: 'Freigabe abbrechen',
    pointCamera: 'Richten Sie die Kamera auf den Bildschirm des Senders',
    cameraAccessError: 'Kamerazugriff fehlgeschlagen. Berechtigungen prüfen.',
    cancelScanner: 'Scanner abbrechen',
    synchronizingDoc: 'Dokument wird synchronisiert...',
    exchangingKeys: 'Verbindung über verschlüsselten WebRTC-Kanal',
    transferCompleted: 'Übertragung erfolgreich abgeschlossen!',
    e2eeSecured: 'Die Kopie wurde als neues Dokument auf diesem Gerät gespeichert.',
    done: 'Fertig'
  },
  'ja': {
    title: 'P2P共有と同期',
    e2eeTransfer: 'エンドツーエンド暗号化（E2EE）転送',
    liveCollaboration: 'ライブ共同編集',
    directQrClone: '直接QRクローン',
    startE2eeSession: 'E2EE同期セッションを開始',
    createsCollaborative: '共同編集用の安全なWebRTCルームを作成します',
    joinPeerSession: 'セッションに参加する',
    enterRoomCodeE2ee: 'ルームコードとE2EEキーを入力して参加します',
    directP2p: '直接ピアツーピア',
    p2pDescription: '編集内容は暗号化されたWebRTCで端末間を直接やり取りします。シグナリングサーバーはパスワードで暗号化された接続情報を中継するだけで、文書を受け取ることはありません。',
    roomCode: 'ルームコード',
    e2eePassword: 'E2EE暗号化キー',
    joinRoom: 'ルームに参加する',
    back: '戻る',
    syncRoomDetails: '同期ルーム詳細',
    copyCredentials: '接続情報をコピー',
    connectedLive: '接続済み',
    connectingToSignaling: 'シグナリングサーバーに接続中...',
    peersInChannel: '接続中のピア',
    connectedPeers: '接続されているピア',
    disconnectStop: '切断してセッションを終了',
    transferDirectly: '別の端末に文書をコピーします。QRコードをスキャンするか転送コードを入力してください。コピーは暗号化されたWebRTCで直接送られ、シグナリングサーバーは端末同士をつなぐだけです。',
    sendDocument: 'ドキュメントを送信',
    generateSharingQr: '共有QRコードを生成',
    scanImport: 'スキャンしてインポート',
    openCamera: 'カメラを起動する',
    scanThisQr: '受信側のデバイスでこのQRコードをスキャンしてください',
    waitingForPeer: 'スキャンと接続を待機中...',
    cancelShare: '共有をキャンセル',
    pointCamera: '送信側の画面にカメラを向けてください',
    cameraAccessError: 'カメラにアクセスできません。権限を確認するかQR画像をアップロードしてください。',
    cancelScanner: 'スキャンをキャンセル',
    synchronizingDoc: 'ドキュメントを同期中...',
    exchangingKeys: '暗号化されたWebRTCチャンネルで接続中',
    transferCompleted: '転送が正常に完了しました！',
    e2eeSecured: 'コピーはこの端末に新しい文書として保存されました。',
    done: '完了'
  },
  'zh': {
    title: 'P2P 分享与同步',
    e2eeTransfer: '端到端加密 (E2EE) 传输',
    liveCollaboration: '实时协作',
    directQrClone: '直接 QR 克隆',
    startE2eeSession: '启动 E2EE 同步会话',
    createsCollaborative: '创建一个协作式 WebRTC 安全室',
    joinPeerSession: '加入同伴会话',
    enterRoomCodeE2ee: '输入房间代码和 E2EE 密钥进行协作',
    directP2p: '直接点对点 (P2P)',
    p2pDescription: '编辑内容通过加密的 WebRTC 在设备之间直接传输。信令服务器只转发经密码加密的连接信息，从不接收您的文档。',
    roomCode: '房间代码',
    e2eePassword: 'E2EE 密码密钥',
    joinRoom: '加入房间',
    back: '返回',
    syncRoomDetails: '同步房间详情',
    copyCredentials: '复制凭据',
    connectedLive: '实时连接成功',
    connectingToSignaling: '正在连接到信令网络...',
    peersInChannel: '个通道中的同伴',
    connectedPeers: '已连接的同伴',
    disconnectStop: '断开并停止实时会话',
    transferDirectly: '将文档复制到另一台设备：扫描二维码或输入传输码。副本通过加密的 WebRTC 直接传输；信令服务器仅负责让设备互相发现。',
    sendDocument: '发送文档',
    generateSharingQr: '生成分享二维码',
    scanImport: '扫描并导入',
    openCamera: '打开设备摄像头',
    scanThisQr: '在接收设备上扫描此二维码',
    waitingForPeer: '等待同伴扫描并连接...',
    cancelShare: '取消分享',
    pointCamera: '将摄像头对准发送方的屏幕',
    cameraAccessError: '无法访问摄像头。请检查权限或上传二维码图片。',
    cancelScanner: '取消扫描',
    synchronizingDoc: '正在同步文档...',
    exchangingKeys: '正在通过加密的 WebRTC 通道连接',
    transferCompleted: '传输成功完成！',
    e2eeSecured: '副本已作为新文档保存在此设备上。',
    done: '完成'
  },
  'uk': {
    title: 'P2P Поділитися & Синхронізувати',
    e2eeTransfer: 'Наскрізне шифрування (E2EE) передачі',
    liveCollaboration: 'Спільна робота наживо',
    directQrClone: 'Прямий QR-клон',
    startE2eeSession: 'Почати сеанс E2EE синхронізації',
    createsCollaborative: 'Створює спільну безпечну WebRTC кімнату',
    joinPeerSession: 'Приєднатися до сеансу',
    enterRoomCodeE2ee: 'Введіть код кімнати та ключ E2EE',
    directP2p: 'Прямий Peer-to-Peer',
    p2pDescription: 'Зміни передаються безпосередньо між пристроями через зашифрований WebRTC. Сигнальний сервер лише пересилає зашифровані паролем пропозиції з’єднання й ніколи не отримує ваш документ.',
    roomCode: 'Код кімнати',
    e2eePassword: 'Пароль E2EE',
    joinRoom: 'Приєднатися до кімнати',
    back: 'Назад',
    syncRoomDetails: 'Деталі кімнати синхронізації',
    copyCredentials: 'Копіювати реквізити',
    connectedLive: 'Підключено наживо',
    connectingToSignaling: 'Підключення до сигнальної мережі...',
    peersInChannel: 'учасників у каналі',
    connectedPeers: 'Підключені учасники',
    disconnectStop: 'Відключитися та закрити кімнату',
    transferDirectly: 'Скопіюйте документ на інший пристрій: відскануйте QR-код або введіть код передачі. Копія передається напряму через зашифрований WebRTC; сигнальний сервер лише знайомить пристрої.',
    sendDocument: 'Надіслати документ',
    generateSharingQr: 'Створити QR для обміну',
    scanImport: 'Сканувати та імпортувати',
    openCamera: 'Відкрити камеру пристрою',
    scanThisQr: 'Відскануйте цей QR-код на пристрої-отримувачі',
    waitingForPeer: 'Очікування підключення партнера...',
    cancelShare: 'Скасувати обмін',
    pointCamera: 'Спрямуйте камеру на екран відправника',
    cameraAccessError: 'Не вдалося отримати доступ до камери. Перевірте дозволи.',
    cancelScanner: 'Скасувати сканер',
    synchronizingDoc: 'Синхронізація документа...',
    exchangingKeys: 'З’єднання через зашифрований канал WebRTC',
    transferCompleted: 'Передачу успішно завершено!',
    e2eeSecured: 'Копію збережено як новий документ на цьому пристрої.',
    done: 'Готово'
  },
  'ru': {
    title: 'P2P Поделиться и Синхронизировать',
    e2eeTransfer: 'Сквозное шифрование (E2EE) передачи',
    liveCollaboration: 'Совместная работа наживую',
    directQrClone: 'Прямой QR-клон',
    startE2eeSession: 'Начать сеанс E2EE синхронизации',
    createsCollaborative: 'Создает совместную безопасную WebRTC комнату',
    joinPeerSession: 'Присоединиться к сеансу',
    enterRoomCodeE2ee: 'Введите код комнаты и ключ E2EE',
    directP2p: 'Прямой Peer-to-Peer',
    p2pDescription: 'Изменения передаются напрямую между устройствами по зашифрованному WebRTC. Сигнальный сервер лишь пересылает зашифрованные паролем предложения соединения и никогда не получает ваш документ.',
    roomCode: 'Код комнаты',
    e2eePassword: 'Пароль E2EE',
    joinRoom: 'Присоединиться к комнате',
    back: 'Назад',
    syncRoomDetails: 'Детали комнаты синхронизации',
    copyCredentials: 'Копировать реквизиты',
    connectedLive: 'Подключено вживую',
    connectingToSignaling: 'Подключение к сигнальной сети...',
    peersInChannel: 'участников в канале',
    connectedPeers: 'Подключенные участники',
    disconnectStop: 'Отключиться и закрыть комнату',
    transferDirectly: 'Скопируйте документ на другое устройство: отсканируйте QR-код или введите код передачи. Копия передаётся напрямую по зашифрованному WebRTC; сигнальный сервер лишь знакомит устройства.',
    sendDocument: 'Отправить документ',
    generateSharingQr: 'Создать QR для обмена',
    scanImport: 'Сканировать и импортировать',
    openCamera: 'Открыть камеру устройства',
    scanThisQr: 'Отсканируйте этот QR-код на устройстве-получателе',
    waitingForPeer: 'Ожидание подключения партнера...',
    cancelShare: 'Отменить обмен',
    pointCamera: 'Направьте камеру на экран отправителя',
    cameraAccessError: 'Не удалось получить доступ к камере. Проверьте разрешения.',
    cancelScanner: 'Отменить сканер',
    synchronizingDoc: 'Синхронизация документа...',
    exchangingKeys: 'Подключение по зашифрованному каналу WebRTC',
    transferCompleted: 'Передача успешно завершена!',
    e2eeSecured: 'Копия сохранена как новый документ на этом устройстве.',
    done: 'Готово'
  },
  'pt': {
    title: "Compartilhar e sincronizar P2P",
    e2eeTransfer: "Transferência com criptografia de ponta a ponta (E2EE)",
    liveCollaboration: "Colaboração ao vivo",
    directQrClone: "Clonagem direta por QR",
    startE2eeSession: "Iniciar sessão de sincronização E2EE",
    createsCollaborative: "Cria uma sala colaborativa segura via WebRTC",
    joinPeerSession: "Entrar em sessão ponto a ponto",
    enterRoomCodeE2ee: "Digite um código de sala e a chave E2EE para colaborar",
    directP2p: "Ponto a ponto direto",
    p2pDescription: "As edições trafegam diretamente entre os dispositivos por WebRTC criptografado. O servidor de sinalização apenas retransmite ofertas de conexão criptografadas com a senha — ele nunca recebe seu documento.",
    roomCode: "Código da sala",
    e2eePassword: "Senha/chave E2EE",
    joinRoom: "Entrar na sala",
    back: "Voltar",
    syncRoomDetails: "Detalhes da sala de sincronização",
    copyCredentials: "Copiar credenciais",
    connectedLive: "Conectado ao vivo",
    connectingToSignaling: "Conectando à rede de sinalização...",
    peersInChannel: "par(es) no canal",
    connectedPeers: "Pares conectados",
    disconnectStop: "Desconectar e encerrar sessão ao vivo",
    transferDirectly: "Copie um documento para outro dispositivo: escaneie o código QR ou digite o código de transferência. A cópia trafega diretamente por WebRTC criptografado; um servidor de sinalização apenas apresenta os dispositivos.",
    sendDocument: "Enviar documento",
    generateSharingQr: "Gerar QR de compartilhamento",
    scanImport: "Escanear e importar",
    openCamera: "Abrir câmera do dispositivo",
    scanThisQr: "Escaneie este código QR no dispositivo receptor",
    waitingForPeer: "Aguardando o par escanear e conectar...",
    cancelShare: "Cancelar compartilhamento",
    pointCamera: "Aponte sua câmera para a tela do remetente",
    cameraAccessError: "Não foi possível acessar a câmera. Verifique as permissões ou envie uma imagem de QR.",
    cancelScanner: "Cancelar leitura",
    synchronizingDoc: "Sincronizando documento...",
    exchangingKeys: "Conectando por um canal WebRTC criptografado",
    transferCompleted: "Transferência concluída com sucesso!",
    e2eeSecured: "A cópia foi salva como um novo documento neste dispositivo.",
    done: "Concluído"
  },
  'it': {
    title: "Condivisione e sincronizzazione P2P",
    e2eeTransfer: "Trasferimento con crittografia end-to-end (E2EE)",
    liveCollaboration: "Collaborazione live",
    directQrClone: "Copia diretta tramite QR",
    startE2eeSession: "Avvia sessione di sincronizzazione E2EE",
    createsCollaborative: "Crea una stanza collaborativa sicura WebRTC",
    joinPeerSession: "Partecipa a una sessione peer",
    enterRoomCodeE2ee: "Inserisci un codice stanza e una chiave E2EE per collaborare",
    directP2p: "Peer-to-peer diretto",
    p2pDescription: "Le modifiche viaggiano direttamente tra i dispositivi tramite WebRTC cifrato. Il server di signaling inoltra solo offerte di connessione cifrate con password: non riceve mai il tuo documento.",
    roomCode: "Codice stanza",
    e2eePassword: "Chiave password E2EE",
    joinRoom: "Entra nella stanza",
    back: "Indietro",
    syncRoomDetails: "Dettagli stanza di sincronizzazione",
    copyCredentials: "Copia credenziali",
    connectedLive: "Connesso in diretta",
    connectingToSignaling: "Connessione alla rete di signaling...",
    peersInChannel: "peer nel canale",
    connectedPeers: "Peer connessi",
    disconnectStop: "Disconnetti e termina la sessione live",
    transferDirectly: "Copia un documento su un altro dispositivo: scansiona il codice QR o digita il codice di trasferimento. La copia viaggia direttamente tramite WebRTC cifrato; un server di signaling si limita a mettere in contatto i dispositivi.",
    sendDocument: "Invia documento",
    generateSharingQr: "Genera QR di condivisione",
    scanImport: "Scansiona e importa",
    openCamera: "Apri la fotocamera del dispositivo",
    scanThisQr: "Scansiona questo codice QR sul dispositivo ricevente",
    waitingForPeer: "In attesa che il peer esegua la scansione e si connetta...",
    cancelShare: "Annulla condivisione",
    pointCamera: "Inquadra con la fotocamera lo schermo del mittente",
    cameraAccessError: "Impossibile accedere alla fotocamera. Controlla le autorizzazioni o carica un'immagine QR.",
    cancelScanner: "Annulla scansione",
    synchronizingDoc: "Sincronizzazione del documento...",
    exchangingKeys: "Connessione tramite un canale WebRTC cifrato",
    transferCompleted: "Trasferimento completato!",
    e2eeSecured: "La copia è stata salvata come nuovo documento su questo dispositivo.",
    done: "Fatto"
  },
  'ko': {
    title: "P2P 공유 및 동기화",
    e2eeTransfer: "종단 간 암호화(E2EE) 전송",
    liveCollaboration: "실시간 공동 작업",
    directQrClone: "QR 직접 복제",
    startE2eeSession: "E2EE 동기화 세션 시작",
    createsCollaborative: "보안 WebRTC 공동 작업 방을 만듭니다",
    joinPeerSession: "피어 세션 참가",
    enterRoomCodeE2ee: "공동 작업할 방 코드와 E2EE 키를 입력하세요",
    directP2p: "직접 P2P 연결",
    p2pDescription: "편집 내용은 암호화된 WebRTC를 통해 기기 간에 직접 전송됩니다. 시그널링 서버는 암호로 암호화된 연결 제안만 전달하며 문서는 절대 받지 않습니다.",
    roomCode: "방 코드",
    e2eePassword: "E2EE 암호 키",
    joinRoom: "방 참가",
    back: "뒤로",
    syncRoomDetails: "동기화 방 정보",
    copyCredentials: "접속 정보 복사",
    connectedLive: "실시간 연결됨",
    connectingToSignaling: "시그널링 네트워크에 연결하는 중...",
    peersInChannel: "명의 피어가 채널에 있음",
    connectedPeers: "연결된 피어",
    disconnectStop: "연결 끊기 및 실시간 세션 중지",
    transferDirectly: "문서를 다른 기기로 복사합니다. QR 코드를 스캔하거나 전송 코드를 입력하세요. 사본은 암호화된 WebRTC를 통해 직접 전송되며, 시그널링 서버는 기기를 서로 소개하는 역할만 합니다.",
    sendDocument: "문서 보내기",
    generateSharingQr: "공유 QR 생성",
    scanImport: "스캔 및 가져오기",
    openCamera: "기기 카메라 열기",
    scanThisQr: "받는 기기에서 이 QR 코드를 스캔하세요",
    waitingForPeer: "상대방이 스캔하고 연결하기를 기다리는 중...",
    cancelShare: "공유 취소",
    pointCamera: "보내는 사람의 화면에 카메라를 향하세요",
    cameraAccessError: "카메라에 액세스할 수 없습니다. 권한을 확인하거나 QR 이미지를 업로드하세요.",
    cancelScanner: "스캐너 취소",
    synchronizingDoc: "문서 동기화 중...",
    exchangingKeys: "암호화된 WebRTC 채널로 연결하는 중",
    transferCompleted: "전송이 완료되었습니다!",
    e2eeSecured: "사본이 이 기기에 새 문서로 저장되었습니다.",
    done: "완료"
  },
  'ar': {
    title: "المشاركة والمزامنة عبر P2P",
    e2eeTransfer: "نقل مشفّر من طرف إلى طرف (E2EE)",
    liveCollaboration: "التعاون المباشر",
    directQrClone: "نسخ مباشر عبر QR",
    startE2eeSession: "بدء جلسة مزامنة E2EE",
    createsCollaborative: "ينشئ غرفة WebRTC آمنة للتعاون",
    joinPeerSession: "الانضمام إلى جلسة نظير",
    enterRoomCodeE2ee: "أدخل رمز الغرفة ومفتاح E2EE للتعاون",
    directP2p: "اتصال مباشر من نظير إلى نظير",
    p2pDescription: "تنتقل التعديلات مباشرةً بين الأجهزة عبر WebRTC المشفّر. يقتصر دور خادم الإشارة على نقل عروض اتصال مشفّرة بكلمة المرور — ولا يتلقى مستندك أبدًا.",
    roomCode: "رمز الغرفة",
    e2eePassword: "مفتاح كلمة مرور E2EE",
    joinRoom: "الانضمام إلى الغرفة",
    back: "رجوع",
    syncRoomDetails: "تفاصيل غرفة المزامنة",
    copyCredentials: "نسخ بيانات الاعتماد",
    connectedLive: "متصل مباشرةً",
    connectingToSignaling: "جارٍ الاتصال بشبكة الإشارة...",
    peersInChannel: "نظير (نظراء) في القناة",
    connectedPeers: "النظراء المتصلون",
    disconnectStop: "قطع الاتصال وإيقاف الجلسة المباشرة",
    transferDirectly: "انسخ مستندًا إلى جهاز آخر: امسح رمز QR أو اكتب رمز النقل. تنتقل النسخة مباشرةً عبر WebRTC المشفّر؛ ويقتصر دور خادم الإشارة على تعريف الأجهزة ببعضها.",
    sendDocument: "إرسال المستند",
    generateSharingQr: "إنشاء رمز QR للمشاركة",
    scanImport: "مسح واستيراد",
    openCamera: "فتح كاميرا الجهاز",
    scanThisQr: "امسح رمز QR هذا على الجهاز المستقبِل",
    waitingForPeer: "بانتظار أن يمسح النظير الرمز ويتصل...",
    cancelShare: "إلغاء المشاركة",
    pointCamera: "وجّه الكاميرا نحو شاشة المرسِل",
    cameraAccessError: "تعذّر الوصول إلى بث الكاميرا. يرجى التحقق من الأذونات أو تحميل صورة QR.",
    cancelScanner: "إلغاء الماسح",
    synchronizingDoc: "جارٍ مزامنة المستند...",
    exchangingKeys: "جارٍ الاتصال عبر قناة WebRTC مشفّرة",
    transferCompleted: "اكتمل النقل بنجاح!",
    e2eeSecured: "حُفظت النسخة كمستند جديد على هذا الجهاز.",
    done: "تم"
  },
  'hi': {
    title: "P2P साझा और सिंक",
    e2eeTransfer: "एंड-टू-एंड एन्क्रिप्टेड (E2EE) ट्रांसफ़र",
    liveCollaboration: "लाइव सहयोग",
    directQrClone: "सीधा QR क्लोन",
    startE2eeSession: "E2EE सिंक सत्र शुरू करें",
    createsCollaborative: "एक सुरक्षित सहयोगी WebRTC रूम बनाता है",
    joinPeerSession: "पीयर सत्र में शामिल हों",
    enterRoomCodeE2ee: "सहयोग करने के लिए रूम कोड और E2EE कुंजी दर्ज करें",
    directP2p: "सीधा पीयर-टू-पीयर",
    p2pDescription: "संपादन एन्क्रिप्टेड WebRTC के ज़रिए सीधे डिवाइसों के बीच जाते हैं। सिग्नलिंग सर्वर केवल पासवर्ड-एन्क्रिप्टेड कनेक्शन ऑफ़र आगे भेजता है — यह आपका दस्तावेज़ कभी प्राप्त नहीं करता।",
    roomCode: "रूम कोड",
    e2eePassword: "E2EE पासवर्ड कुंजी",
    joinRoom: "रूम में शामिल हों",
    back: "वापस",
    syncRoomDetails: "सिंक रूम विवरण",
    copyCredentials: "क्रेडेंशियल कॉपी करें",
    connectedLive: "लाइव कनेक्टेड",
    connectingToSignaling: "सिग्नलिंग नेटवर्क से कनेक्ट हो रहा है...",
    peersInChannel: "पीयर चैनल में",
    connectedPeers: "कनेक्टेड पीयर",
    disconnectStop: "डिस्कनेक्ट करें और लाइव सत्र रोकें",
    transferDirectly: "किसी दूसरे डिवाइस पर दस्तावेज़ कॉपी करें: QR कोड स्कैन करें या ट्रांसफ़र कोड टाइप करें। कॉपी सीधे एन्क्रिप्टेड WebRTC के ज़रिए जाती है; सिग्नलिंग सर्वर केवल डिवाइसों का परिचय कराता है।",
    sendDocument: "दस्तावेज़ भेजें",
    generateSharingQr: "साझा करने का QR बनाएँ",
    scanImport: "स्कैन और आयात करें",
    openCamera: "डिवाइस कैमरा खोलें",
    scanThisQr: "प्राप्त करने वाले डिवाइस पर यह QR कोड स्कैन करें",
    waitingForPeer: "पीयर के स्कैन और कनेक्ट करने की प्रतीक्षा हो रही है...",
    cancelShare: "साझा करना रद्द करें",
    pointCamera: "अपना कैमरा भेजने वाले की स्क्रीन की ओर करें",
    cameraAccessError: "कैमरा फ़ीड तक पहुँच नहीं हो सकी। कृपया अनुमतियाँ जाँचें या QR छवि अपलोड करें।",
    cancelScanner: "स्कैनर रद्द करें",
    synchronizingDoc: "दस्तावेज़ सिंक हो रहा है...",
    exchangingKeys: "एन्क्रिप्टेड WebRTC चैनल पर कनेक्ट हो रहा है",
    transferCompleted: "ट्रांसफ़र सफलतापूर्वक पूरा हुआ!",
    e2eeSecured: "कॉपी इस डिवाइस पर नए दस्तावेज़ के रूप में सहेजी गई।",
    done: "हो गया"
  }
};

interface CollaborationDialogProps {
  isOpen: boolean;
  onClose: () => void;
  darkMode: boolean;
  uiLanguage: LanguageCode;
}

type QrAction = 'menu' | 'send' | 'receive' | 'transferring' | 'success';

const QR_TIMEOUT_MS = 60_000;
const SIGNALING_ERROR_AFTER_MS = 8_000;
const NO_PEERS_HINT_AFTER_MS = 20_000;
const COLOR_KEY = 'penko_writer_collab_color';

const fill = (text: string, vars: Record<string, string>) => text.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? '');

/** The collaborative editor is bound to `ydoc` once its collaboration extension uses that doc. */
const isEditorBoundTo = (editor: any, ydoc: Y.Doc) =>
  !!editor && !editor.isDestroyed && editor.extensionManager?.extensions?.some((e: any) => e.name === 'collaboration' && e.options?.document === ydoc);

const loadColor = () => {
  try {
    const c = localStorage.getItem(COLOR_KEY);
    if (c && USER_COLORS.includes(c)) return c;
    const next = randomUserColor();
    localStorage.setItem(COLOR_KEY, next);
    return next;
  } catch {
    return randomUserColor();
  }
};

/** Whitelists the fields a received document may carry. Content is sanitized by handleCreateDocument. */
const pickTransferredDoc = (raw: Record<string, unknown>, fallbackTitle: string): Partial<DocumentData> => {
  const str = (v: unknown, max = 200_000_000) => (typeof v === 'string' ? v.slice(0, max) : undefined);
  const out: Partial<DocumentData> = {
    title: str(raw.title, 200) || fallbackTitle,
    content: str(raw.content) || '<p></p>',
  };
  if (typeof raw.language === 'string') out.language = raw.language.slice(0, 20);
  if (raw.pageConfig && typeof raw.pageConfig === 'object') out.pageConfig = raw.pageConfig as DocumentData['pageConfig'];
  if (typeof raw.header === 'string') out.header = raw.header;
  if (typeof raw.footer === 'string') out.footer = raw.footer;
  if (typeof raw.showPageNumbers === 'boolean') out.showPageNumbers = raw.showPageNumbers;
  if (typeof raw.pageNumberPosition === 'string') out.pageNumberPosition = raw.pageNumberPosition as DocumentData['pageNumberPosition'];
  if (Array.isArray(raw.comments)) out.comments = raw.comments as DocumentData['comments'];
  if (Array.isArray(raw.citations)) out.citations = raw.citations as DocumentData['citations'];
  if (typeof raw.isScreenplay === 'boolean') out.isScreenplay = raw.isScreenplay;
  return out;
};

export const CollaborationDialog: React.FC<CollaborationDialogProps> = ({ isOpen, onClose, darkMode, uiLanguage }) => {
  const {
    currentDoc,
    documents,
    editor,
    handleCreateDocument,
    handleOpenDoc,
    updateCurrentDoc,
    flushPendingEdits,
    collabSession,
    setCollabSession,
    currentUser,
    setCurrentUser,
    setShowCollaborationDialog,
    toast,
    isMobile,
  } = useApp();
  const live = useLiveSession();
  const session = live.session;
  const tr = (key: string, vars?: Record<string, string>) => (vars ? fill(t(uiLanguage, key), vars) : t(uiLanguage, key));

  const [activeTab, setActiveTab] = useState<'collab' | 'qr'>('collab');
  const [mode, setMode] = useState<'menu' | 'join'>('menu');
  const [inputRoomId, setInputRoomId] = useState('');
  const [inputPassword, setInputPassword] = useState('');
  const [copied, setCopied] = useState(false);
  const [nameDraft, setNameDraft] = useState(currentUser);
  const [userColor] = useState(loadColor);
  const [now, setNow] = useState(Date.now());

  // Connection settings
  const [showSettings, setShowSettings] = useState(false);
  const [config, setConfig] = useState<CollabConfig>(() => loadCollabConfig());
  const [signalingDraft, setSignalingDraft] = useState(() => config.signaling.join('\n'));
  const [turnUrlDraft, setTurnUrlDraft] = useState(config.turnUrl);
  const [turnUserDraft, setTurnUserDraft] = useState(config.turnUsername);
  const [turnCredDraft, setTurnCredDraft] = useState(config.turnCredential);
  const [settingsError, setSettingsError] = useState('');

  // QR Mode States
  const [qrAction, setQrActionState] = useState<QrAction>('menu');
  const [qrRole, setQrRole] = useState<'sender' | 'receiver'>('sender');
  const [qrCodeUrl, setQrCodeUrl] = useState('');
  const [transferCodeText, setTransferCodeText] = useState('');
  const [scanError, setScanError] = useState('');
  const [qrError, setQrError] = useState('');
  const [manualCode, setManualCode] = useState('');
  const [transferProgress, setTransferProgress] = useState(0);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scannerActiveRef = useRef(false);
  const qrActionRef = useRef<QrAction>('menu');
  const transferRef = useRef<TransferHandle | null>(null);
  const timeoutRef = useRef<number>(0);
  const mountedRef = useRef(true);

  const setQrAction = (a: QrAction) => {
    qrActionRef.current = a;
    setQrActionState(a);
  };

  useEffect(() => setNameDraft(currentUser), [currentUser]);

  /* ------------------------- live session ------------------------- */

  // Keep the context's collab binding in sync with the session store (e.g. after a remount)
  useEffect(() => {
    if (session && (!collabSession || collabSession.document !== session.ydoc)) {
      setCollabSession({ docId: session.docId, document: session.ydoc, provider: session.provider, user: session.user });
    }
  }, [session]); // eslint-disable-line react-hooks/exhaustive-deps

  // Host: seed the shared document once the collaborative editor is bound to it (only if empty)
  useEffect(() => {
    if (!session || session.role !== 'host' || session.seedHtml === null) return;
    if (!isEditorBoundTo(editor, session.ydoc)) return;
    const ed = editor!;
    const timer = window.setTimeout(() => {
      if (ed.isDestroyed || !isEditorBoundTo(ed, session.ydoc) || session.seedHtml === null) return;
      const fragment = session.ydoc.getXmlFragment('default');
      const html = consumeSeed();
      if (!html || !(fragment.length === 0 || ed.isEmpty)) return;
      ed.chain().setMeta('addToHistory', false).setMeta('preventTrack', true).setContent(prepareHtmlForEditor(html)).run();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [editor, session]);

  // Guest: adopt the host's document metadata (title, page setup, language)
  useEffect(() => {
    if (!session || session.role !== 'guest') return;
    const meta = session.ydoc.getMap<any>('meta');
    let applied = false;
    const apply = () => {
      if (applied || !meta.size) return;
      applied = true;
      const patch: Partial<DocumentData> = {};
      const title = meta.get('title');
      if (typeof title === 'string' && title.trim()) patch.title = title.slice(0, 200);
      const pageConfig = meta.get('pageConfig');
      if (pageConfig && typeof pageConfig === 'object') patch.pageConfig = pageConfig;
      const language = meta.get('language');
      if (typeof language === 'string') patch.language = language.slice(0, 20);
      updateCurrentDoc(d => (d.id === session.docId ? patch : {}));
    };
    apply();
    meta.observe(apply);
    return () => meta.unobserve(apply);
  }, [session]); // eslint-disable-line react-hooks/exhaustive-deps

  // Tick while connecting so time-based hints appear
  useEffect(() => {
    if (!session || (live.signalingConnected && live.synced)) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [session, live.signalingConnected, live.synced]);

  // Toasts on connection / participant changes
  const prevLive = useRef(live);
  useEffect(() => {
    const prev = prevLive.current;
    prevLive.current = live;
    if (!session || prev.session !== session) return;
    if (prev.signalingConnected && !live.signalingConnected) toast.warning(tr('collabConnectionLost'));
    if (!prev.signalingConnected && live.signalingConnected && prev.everConnected) toast.success(tr('collabReconnected'));
    if (!prev.synced && live.synced && session.role === 'guest') toast.success(tr('collabJoined'));
    const before = new Map(prev.participants.map(p => [p.id, p]));
    const after = new Map(live.participants.map(p => [p.id, p]));
    live.participants.forEach(p => !p.isSelf && !before.has(p.id) && toast.info(tr('collabUserJoined', { name: p.name })));
    prev.participants.forEach(p => !p.isSelf && !after.has(p.id) && toast.info(tr('collabUserLeft', { name: p.name })));
  }, [live]); // eslint-disable-line react-hooks/exhaustive-deps

  const signalingError = !!session && !live.signalingConnected && !live.everConnected && now - session.startedAt > SIGNALING_ERROR_AFTER_MS;
  const signalingErrorToasted = useRef(false);
  useEffect(() => {
    if (signalingError && !signalingErrorToasted.current) {
      signalingErrorToasted.current = true;
      toast.error(tr('collabSignalingUnreachable'), 8000);
    }
    if (!session) signalingErrorToasted.current = false;
  }, [signalingError, session]); // eslint-disable-line react-hooks/exhaustive-deps

  const leaveSession = (reason?: string) => {
    const s = getLiveState().session;
    if (!s) return;
    const seed = s.seedHtml;
    flushPendingEdits();
    setCollabSession(null);
    // The seed never reached the shared doc (editor was never bound): keep the original content
    if (seed !== null) updateCurrentDoc(d => (d.id === s.docId ? { content: prepareHtmlForEditor(seed) } : {}));
    // Unbind the editor first, then tear the provider down
    window.setTimeout(() => void stopLiveSession(), 50);
    toast.info(reason || tr('collabLeft'));
  };

  // The shared document was deleted -> leave
  useEffect(() => {
    if (session && documents.length && !documents.some(d => d.id === session.docId)) leaveSession(tr('collabDocRemoved'));
  }, [documents, session]); // eslint-disable-line react-hooks/exhaustive-deps

  const currentUserObj = () => ({ name: (nameDraft.trim() || currentUser || 'User').slice(0, 60), color: userColor });

  const commitName = () => {
    const name = nameDraft.trim();
    if (!name) {
      setNameDraft(currentUser);
      return;
    }
    if (name !== currentUser) setCurrentUser(name);
    const user = { name: name.slice(0, 60), color: userColor };
    if (session) {
      updateLiveUser(user);
      if (isEditorBoundTo(editor, session.ydoc)) (editor!.commands as any).updateUser?.(user);
    }
  };

  const handleCopyCredentials = async () => {
    if (!session) return;
    const text = tr('collabCredentialsText', { room: formatCode(session.roomCode, 5), password: formatCode(session.password, 4) });
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      toast.success(tr('collabCopied'));
      window.setTimeout(() => mountedRef.current && setCopied(false), 2000);
    } catch {
      toast.error(tr('collabCopyFailed'));
    }
  };

  // Start Live Collaboration (host)
  const handleStartHosting = () => {
    if (!currentDoc) {
      toast.error(tr('collabNoDocument'));
      return;
    }
    const seedHtml = editor && !editor.isDestroyed ? editor.getHTML() : currentDoc.content;
    flushPendingEdits();
    const user = currentUserObj();
    commitName();
    const s = startLiveSession({
      role: 'host',
      roomCode: generateRoomCode(),
      password: generatePassword(),
      docId: currentDoc.id,
      user,
      config,
      seedHtml,
      meta: { title: currentDoc.title, pageConfig: currentDoc.pageConfig, language: currentDoc.language },
    });
    setCollabSession({ docId: s.docId, document: s.ydoc, provider: s.provider, user });
    toast.success(tr('collabSessionStarted'));
  };

  const canJoin = isValidRoomCode(inputRoomId) && isValidPassword(inputPassword);

  const handleJoinSession = () => {
    if (!canJoin) return;
    const user = currentUserObj();
    commitName();
    const doc = handleCreateDocument({ title: tr('collabSharedDocTitle'), content: '' }, { select: true });
    const s = startLiveSession({ role: 'guest', roomCode: inputRoomId, password: inputPassword, docId: doc.id, user, config });
    setCollabSession({ docId: s.docId, document: s.ydoc, provider: s.provider, user });
    setInputRoomId('');
    setInputPassword('');
    setMode('menu');
  };

  /* ----------------------- connection settings ---------------------- */

  const saveSettings = () => {
    const signaling = parseSignalingList(signalingDraft);
    if (!signaling.length) {
      setSettingsError(tr('collabInvalidSignaling'));
      return;
    }
    if (turnUrlDraft.trim() && !isValidTurnUrl(turnUrlDraft)) {
      setSettingsError(tr('collabInvalidTurn'));
      return;
    }
    const next: CollabConfig = { signaling, turnUrl: turnUrlDraft.trim(), turnUsername: turnUserDraft, turnCredential: turnCredDraft };
    saveCollabConfig(next);
    setConfig(next);
    setSignalingDraft(signaling.join('\n'));
    setSettingsError('');
    toast.success(tr('collabSettingsSaved'));
  };

  const resetSettings = () => {
    const next = { ...DEFAULT_COLLAB_CONFIG };
    saveCollabConfig(next);
    setConfig(next);
    setSignalingDraft(next.signaling.join('\n'));
    setTurnUrlDraft('');
    setTurnUserDraft('');
    setTurnCredDraft('');
    setSettingsError('');
  };

  /* --------------------------- QR transfer -------------------------- */

  const clearQrTimeout = () => {
    window.clearTimeout(timeoutRef.current);
    timeoutRef.current = 0;
  };

  const stopQrSession = () => {
    clearQrTimeout();
    const handle = transferRef.current;
    transferRef.current = null;
    if (handle) void handle.cancel();
    setQrCodeUrl('');
    setTransferCodeText('');
  };

  const armQrTimeout = () => {
    clearQrTimeout();
    timeoutRef.current = window.setTimeout(() => {
      if (!mountedRef.current) return;
      if (qrActionRef.current === 'transferring' || qrActionRef.current === 'send') {
        stopQrSession();
        setQrError(tr('qrTransferTimedOut'));
        setQrAction('menu');
      }
    }, QR_TIMEOUT_MS);
  };

  const finishQrSuccess = () => {
    clearQrTimeout();
    setTransferProgress(100);
    setQrAction('success');
    // Give the final update (ack) a moment to flush before closing the connection
    const handle = transferRef.current;
    transferRef.current = null;
    window.setTimeout(() => void handle?.cancel(), 1500);
  };

  // Direct QR Transfer - Sending Role
  const startQrSend = async () => {
    if (!currentDoc) {
      toast.error(tr('collabNoDocument'));
      return;
    }
    stopQrSession();
    setQrError('');
    setQrRole('sender');
    setTransferProgress(0);
    try {
      flushPendingEdits();
      const code = generateTransferCode();
      const content = editor && !editor.isDestroyed ? editor.getHTML() : currentDoc.content;
      const doc: Record<string, unknown> = {
        title: currentDoc.title,
        content,
        language: currentDoc.language,
        pageConfig: currentDoc.pageConfig,
        header: currentDoc.header,
        footer: currentDoc.footer,
        showPageNumbers: currentDoc.showPageNumbers,
        pageNumberPosition: currentDoc.pageNumberPosition,
        comments: currentDoc.comments,
        citations: currentDoc.citations,
        isScreenplay: currentDoc.isScreenplay,
      };
      const qrData = await QRCode.toDataURL(transferQrPayload(code), { margin: 2, scale: 6 });
      setQrCodeUrl(qrData);
      setTransferCodeText(formatTransferCode(code));
      setQrAction('send');
      transferRef.current = startTransferSend(code, { doc }, config, {
        onReceiverJoined: () => {
          if (!mountedRef.current) return;
          setQrAction('transferring');
          setTransferProgress(30);
          armQrTimeout();
        },
        onProgress: p => mountedRef.current && setTransferProgress(Math.max(30, p)),
        onAcknowledged: () => mountedRef.current && finishQrSuccess(),
      });
    } catch (err) {
      console.error('Failed to start QR transfer:', err);
      stopQrSession();
      setQrError(tr('qrTransferFailed'));
      setQrAction('menu');
    }
  };

  // Direct QR Transfer - Receiving Role
  const stopCameraScanner = () => {
    scannerActiveRef.current = false;
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
  };

  const startCameraScanner = async () => {
    stopQrSession();
    setScanError('');
    setQrError('');
    setManualCode('');
    setQrRole('receiver');
    setQrAction('receive');
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error('no camera');
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      if (!mountedRef.current || qrActionRef.current !== 'receive') {
        stream.getTracks().forEach(tk => tk.stop());
        return;
      }
      streamRef.current = stream;
      scannerActiveRef.current = true;
      const video = videoRef.current;
      if (video) {
        video.srcObject = stream;
        video.setAttribute('playsinline', 'true');
        await video.play().catch(() => {});
        requestAnimationFrame(tickScanner);
      }
    } catch {
      setScanError(p2pText.cameraAccessError);
      stopCameraScanner();
    }
  };

  const tickScanner = () => {
    if (!scannerActiveRef.current || !videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (video.readyState === video.HAVE_ENOUGH_DATA && ctx && video.videoWidth) {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const code = jsQR(imageData.data, imageData.width, imageData.height, { inversionAttempts: 'dontInvert' });
      const parsed = code?.data ? parseTransferCode(code.data) : null;
      if (parsed) {
        stopCameraScanner();
        triggerP2PImport(parsed);
        return;
      }
    }
    requestAnimationFrame(tickScanner);
  };

  const handleQrImage = async (file: File | undefined) => {
    if (!file) return;
    setScanError('');
    const url = URL.createObjectURL(file);
    try {
      const img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const el = new Image();
        el.onload = () => resolve(el);
        el.onerror = reject;
        el.src = url;
      });
      const scale = Math.min(1, 1600 / Math.max(img.naturalWidth, img.naturalHeight));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
      canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('no canvas');
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const code = jsQR(data.data, data.width, data.height, { inversionAttempts: 'attemptBoth' });
      const parsed = code?.data ? parseTransferCode(code.data) : null;
      if (!parsed) {
        setScanError(tr('qrNoCodeInImage'));
        return;
      }
      stopCameraScanner();
      triggerP2PImport(parsed);
    } catch {
      setScanError(tr('qrNoCodeInImage'));
    } finally {
      URL.revokeObjectURL(url);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleManualCode = () => {
    const parsed = parseTransferCode(manualCode);
    if (!parsed) {
      setScanError(tr('qrInvalidCode'));
      return;
    }
    stopCameraScanner();
    triggerP2PImport(parsed);
  };

  const triggerP2PImport = (code: TransferCode) => {
    stopQrSession();
    setQrRole('receiver');
    setQrAction('transferring');
    setTransferProgress(10);
    armQrTimeout();
    transferRef.current = startTransferReceive(code, config, {
      onConnected: () => mountedRef.current && setTransferProgress(p => Math.max(p, 30)),
      onProgress: p => mountedRef.current && setTransferProgress(prev => Math.max(prev, p)),
      onDocument: raw => {
        handleCreateDocument(pickTransferredDoc(raw, tr('collabSharedDocTitle')), { select: true });
        if (mountedRef.current) finishQrSuccess();
      },
      onError: () => {
        if (!mountedRef.current) return;
        stopQrSession();
        setQrError(tr('qrTransferFailed'));
        setQrAction('menu');
      },
    });
  };

  // Cleanup on unmount (the live session itself lives in the store and survives)
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      stopCameraScanner();
      clearQrTimeout();
      const handle = transferRef.current;
      transferRef.current = null;
      if (handle) void handle.cancel();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Escape closes (or, during a session, minimises) the dialog
  const closeRef = useRef<() => void>(() => {});
  useEscapeKey(isOpen, () => closeRef.current());
  // Move focus into the dialog (and back on close) so keys don't go to the editor
  const panelRef = useFocusTrap<HTMLDivElement>(isOpen);

  const langKey = uiLanguage in LOCALIZED_P2P ? uiLanguage : 'en-US';
  const p2pText = { ...LOCALIZED_P2P['en-US'], ...LOCALIZED_P2P[langKey] };

  const others = live.participants.filter(p => !p.isSelf);
  const peerCount = Math.max(others.length, live.webrtcPeers);
  const sharedDoc = session ? documents.find(d => d.id === session.docId) : undefined;
  const onOtherDoc = !!session && currentDoc?.id !== session.docId;
  const waitingForHost = !!session && session.role === 'guest' && !live.synced;
  const noPeersHint = waitingForHost && live.signalingConnected && now - session!.startedAt > NO_PEERS_HINT_AFTER_MS;

  const inputClass = `w-full px-4 py-3 rounded-xl font-mono text-base tracking-widest text-center border focus:ring-2 focus:ring-blue-500 outline-none ${
    darkMode ? 'bg-zinc-800 border-zinc-700 text-white' : 'bg-gray-50 border-gray-200 text-gray-900'
  }`;
  const smallInputClass = `w-full px-3 py-2 rounded-xl text-xs border focus:ring-2 focus:ring-blue-500 outline-none ${
    darkMode ? 'bg-zinc-800 border-zinc-700 text-white' : 'bg-gray-50 border-gray-200 text-gray-900'
  }`;
  const labelClass = `block text-xs font-bold uppercase tracking-wider mb-2 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`;

  const nameField = (
    <div>
      <label htmlFor="collab-display-name" className={labelClass}>
        {tr('collabYourName')}
      </label>
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 shrink-0 rounded-full flex items-center justify-center text-white text-xs font-bold" style={{ backgroundColor: userColor }}>
          {(nameDraft.trim()[0] || '?').toUpperCase()}
        </div>
        <input
          id="collab-display-name"
          type="text"
          value={nameDraft}
          maxLength={60}
          onChange={e => setNameDraft(e.target.value)}
          onBlur={commitName}
          onKeyDown={e => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
          className={smallInputClass}
        />
      </div>
    </div>
  );

  /* ---------------------------- minimised ---------------------------- */

  if (!isOpen) {
    if (!session) return null;
    const connecting = !live.signalingConnected || waitingForHost;
    return (
      <div
        key="pill" // a fresh element: don't transition from the dialog's inset-0 box
        data-testid="collab-status-pill"
        className={`fixed z-40 print:hidden ${isMobile ? 'bottom-24 left-3' : 'bottom-6 left-24'} h-10 pl-2 pr-1.5 rounded-full shadow-lg border backdrop-blur-md flex items-center gap-2 select-none transition-all text-xs
          ${darkMode ? 'bg-[#1e1e1e]/90 border-gray-700 text-gray-300' : 'bg-white/90 border-gray-200 text-gray-600'}`}
      >
        <button
          onClick={() => setShowCollaborationDialog(true)}
          title={tr('collabOpenSession')}
          aria-label={tr('collabOpenSession')}
          className="flex items-center gap-2 pl-1 pr-1 h-8 rounded-full hover:text-blue-500 transition-colors"
        >
          <span className="relative flex w-2.5 h-2.5">
            {connecting && <span className="absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75 animate-ping" />}
            <span className={`relative inline-flex w-2.5 h-2.5 rounded-full ${connecting ? 'bg-amber-500' : 'bg-green-500'}`} />
          </span>
          <Users className="w-4 h-4" />
          <span className="font-medium">
            {connecting ? (live.everConnected && !live.signalingConnected ? tr('collabReconnectingShort') : tr('collabConnectingShort')) : tr('collabLivePill')}
          </span>
          <span className="flex -space-x-1.5">
            {live.participants.slice(0, 4).map(p => (
              <span
                key={p.id}
                title={p.isSelf ? `${p.name} (${tr('collabYou')})` : p.name}
                className={`w-6 h-6 rounded-full flex items-center justify-center text-white text-[10px] font-bold border-2 ${darkMode ? 'border-[#1e1e1e]' : 'border-white'}`}
                style={{ backgroundColor: p.color }}
              >
                {(p.name[0] || '?').toUpperCase()}
              </span>
            ))}
          </span>
          <span className="font-medium" data-testid="collab-pill-count">
            {live.participants.length}
          </span>
        </button>
        <div className={`w-px h-4 ${darkMode ? 'bg-gray-700' : 'bg-gray-300'}`}></div>
        <button
          onClick={() => leaveSession()}
          className="px-2.5 h-7 rounded-full font-semibold text-red-500 hover:bg-red-500/10 transition-colors"
        >
          {tr('collabLeave')}
        </button>
      </div>
    );
  }

  const closeDialog = () => {
    if (!session) {
      stopCameraScanner();
      stopQrSession();
      setQrAction('menu');
    }
    onClose();
  };
  closeRef.current = closeDialog;

  return (
    <div key="dialog" className="fixed inset-0 bg-black/60 flex items-center justify-center z-[100] backdrop-blur-md p-4 print:hidden" role="dialog" aria-modal="true" aria-label={p2pText.title}>
      <div ref={panelRef} className={`max-w-md w-full max-h-full overflow-y-auto rounded-3xl shadow-2xl border transition-all duration-300 ${
        darkMode ? 'bg-zinc-900 border-zinc-800 text-gray-100' : 'bg-white border-gray-100 text-gray-800'
      }`}>

        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-6 text-white relative">
          <button
            onClick={closeDialog}
            title={session ? tr('collabMinimize') : tr('close')}
            aria-label={session ? tr('collabMinimize') : tr('close')}
            className="absolute top-4 right-4 text-white/80 hover:text-white hover:bg-white/10 p-1.5 rounded-full transition-all"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-white/20 backdrop-blur rounded-2xl flex items-center justify-center">
              <Share2 className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <h2 className="text-xl font-bold tracking-tight">{p2pText.title}</h2>
              <p className="text-blue-100 text-xs flex items-center gap-1 mt-0.5">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                {p2pText.e2eeTransfer}
              </p>
            </div>
          </div>
        </div>

        {/* Tab Switching Selector */}
        {!session && mode === 'menu' && qrAction === 'menu' && (
          <div className={`flex border-b text-xs font-semibold ${darkMode ? 'border-zinc-800' : 'border-gray-200'}`}>
            <button
              onClick={() => setActiveTab('collab')}
              className={`flex-1 py-3 text-center border-b-2 transition-all ${
                activeTab === 'collab'
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              <span className="flex items-center justify-center gap-1.5">
                <Users className="w-4 h-4" /> {p2pText.liveCollaboration}
              </span>
            </button>
            <button
              onClick={() => setActiveTab('qr')}
              className={`flex-1 py-3 text-center border-b-2 transition-all ${
                activeTab === 'qr'
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              <span className="flex items-center justify-center gap-1.5">
                <QrCode className="w-4 h-4" /> {p2pText.directQrClone}
              </span>
            </button>
          </div>
        )}

        {/* Modal Panels Content */}
        <div className="p-6">
          {activeTab === 'collab' || session ? (
            /* Live Collaboration Room Panel */
            <div>
              {!session && mode === 'menu' && (
                <div className="space-y-4">
                  {nameField}

                  <button
                    onClick={handleStartHosting}
                    className="w-full p-4 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white transition-all transform active:scale-95 shadow-md flex items-center justify-between"
                  >
                    <div className="text-left">
                      <div className="font-bold text-sm tracking-wide">{p2pText.startE2eeSession}</div>
                      <div className="text-[10px] text-blue-100 mt-0.5">{p2pText.createsCollaborative}</div>
                    </div>
                    <Users className="w-5 h-5 opacity-80" />
                  </button>

                  <button
                    onClick={() => setMode('join')}
                    className={`w-full p-4 rounded-2xl transition-all text-left flex items-center justify-between border ${
                      darkMode ? 'bg-zinc-800/50 border-zinc-700 hover:bg-zinc-800' : 'bg-gray-50 border-gray-100 hover:bg-gray-100'
                    }`}
                  >
                    <div>
                      <div className="font-bold text-sm tracking-wide">{p2pText.joinPeerSession}</div>
                      <div className="text-[10px] opacity-60 mt-0.5">{p2pText.enterRoomCodeE2ee}</div>
                    </div>
                    <ArrowRightLeft className="w-5 h-5 opacity-80" />
                  </button>

                  <div className={`p-4 rounded-2xl text-xs leading-relaxed border ${
                    darkMode ? 'bg-zinc-950/40 border-zinc-800 text-gray-400' : 'bg-blue-50/50 border-blue-100 text-gray-600'
                  }`}>
                    <div className="font-semibold text-blue-600 dark:text-blue-400 flex items-center gap-1 mb-1">
                      <Info className="w-3.5 h-3.5" /> {p2pText.directP2p}
                    </div>
                    {p2pText.p2pDescription}
                  </div>

                  {/* Connection settings (signaling / TURN) */}
                  <div>
                    <button
                      onClick={() => setShowSettings(v => !v)}
                      aria-expanded={showSettings}
                      className="text-xs text-blue-500 hover:underline flex items-center gap-1 font-semibold"
                    >
                      <Settings2 className="w-3.5 h-3.5" /> {tr('collabConnectionSettings')}
                    </button>
                    {showSettings && (
                      <div className={`mt-3 p-4 rounded-2xl border space-y-3 text-left ${darkMode ? 'bg-zinc-800/30 border-zinc-700' : 'bg-gray-50 border-gray-200'}`}>
                        <div>
                          <label htmlFor="collab-signaling" className={labelClass}>{tr('collabSignalingServers')}</label>
                          <textarea
                            id="collab-signaling"
                            rows={3}
                            value={signalingDraft}
                            onChange={e => setSignalingDraft(e.target.value)}
                            spellCheck={false}
                            className={`${smallInputClass} font-mono resize-y`}
                          />
                          <p className="text-[10px] opacity-60 mt-1 leading-relaxed">{tr('collabSignalingHint')}</p>
                        </div>
                        <div>
                          <label htmlFor="collab-turn-url" className={labelClass}>{tr('collabTurnServer')}</label>
                          <input id="collab-turn-url" type="text" value={turnUrlDraft} onChange={e => setTurnUrlDraft(e.target.value)} placeholder="turn:turn.example.com:3478" spellCheck={false} className={`${smallInputClass} font-mono`} />
                          {turnUrlDraft.trim() && (
                            <div className="grid grid-cols-2 gap-2 mt-2">
                              <input type="text" value={turnUserDraft} onChange={e => setTurnUserDraft(e.target.value)} placeholder={tr('collabTurnUsername')} aria-label={tr('collabTurnUsername')} className={smallInputClass} />
                              <input type="password" value={turnCredDraft} onChange={e => setTurnCredDraft(e.target.value)} placeholder={tr('collabTurnCredential')} aria-label={tr('collabTurnCredential')} className={smallInputClass} />
                            </div>
                          )}
                        </div>
                        {settingsError && <div className="p-2 rounded-xl border border-red-500 bg-red-500/10 text-red-500 text-xs">{settingsError}</div>}
                        <div className="flex gap-2">
                          <button onClick={saveSettings} className="flex-1 py-2 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white transition-colors">
                            {tr('collabSave')}
                          </button>
                          <button
                            onClick={resetSettings}
                            className={`px-4 py-2 rounded-xl text-xs font-semibold transition-colors ${darkMode ? 'bg-zinc-800 hover:bg-zinc-700 text-gray-200' : 'bg-gray-200 hover:bg-gray-300 text-gray-700'}`}
                          >
                            {tr('collabResetDefaults')}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {!session && mode === 'join' && (
                <div className="space-y-4">
                  {nameField}
                  <div>
                    <label htmlFor="collab-room-code" className={labelClass}>
                      {p2pText.roomCode}
                    </label>
                    <input
                      id="collab-room-code"
                      type="text"
                      value={inputRoomId}
                      onChange={(e) => setInputRoomId(e.target.value.toUpperCase())}
                      placeholder={tr('collabRoomCodePlaceholder')}
                      maxLength={40}
                      autoComplete="off"
                      spellCheck={false}
                      className={inputClass}
                    />
                  </div>

                  <div>
                    <label htmlFor="collab-room-password" className={labelClass}>
                      {p2pText.e2eePassword}
                    </label>
                    <input
                      id="collab-room-password"
                      type="text"
                      value={inputPassword}
                      onChange={(e) => setInputPassword(e.target.value.toUpperCase())}
                      onKeyDown={e => e.key === 'Enter' && handleJoinSession()}
                      placeholder={tr('collabPasswordPlaceholder')}
                      maxLength={80}
                      autoComplete="off"
                      spellCheck={false}
                      className={inputClass}
                    />
                  </div>

                  <div className="flex gap-3">
                    <button
                      onClick={handleJoinSession}
                      disabled={!canJoin}
                      className="flex-1 px-6 py-3 rounded-xl font-bold bg-blue-600 hover:bg-blue-700 text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      {p2pText.joinRoom}
                    </button>
                    <button
                      onClick={() => setMode('menu')}
                      className={`px-6 py-3 rounded-xl font-semibold transition-colors ${
                        darkMode ? 'bg-zinc-800 hover:bg-zinc-700 text-gray-200' : 'bg-gray-200 hover:bg-gray-300 text-gray-700'
                      }`}
                    >
                      {p2pText.back}
                    </button>
                  </div>
                </div>
              )}

              {session && (
                <div className="space-y-4" data-testid="collab-session-panel">
                  <div className={`p-4 rounded-2xl border ${darkMode ? 'bg-zinc-800/30 border-zinc-700' : 'bg-gray-50 border-gray-200'}`}>
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-xs font-semibold uppercase tracking-wider">{p2pText.syncRoomDetails}</span>
                      <button
                        onClick={handleCopyCredentials}
                        className="text-xs text-blue-500 hover:underline flex items-center gap-1 font-semibold"
                      >
                        {copied ? <CheckCircle className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                        {p2pText.copyCredentials}
                      </button>
                    </div>

                    <div className="grid grid-cols-2 gap-4 text-center font-mono">
                      <div className="p-2 rounded-xl bg-black/10">
                        <div className="text-[10px] uppercase opacity-55">{p2pText.roomCode}</div>
                        <div className="font-bold text-sm tracking-wider mt-0.5 break-words select-all" data-testid="collab-room-code">{formatCode(session.roomCode, 5)}</div>
                      </div>
                      <div className="p-2 rounded-xl bg-black/10">
                        <div className="text-[10px] uppercase opacity-55">{p2pText.e2eePassword}</div>
                        <div className="font-bold text-sm tracking-wider mt-0.5 break-words select-all" data-testid="collab-room-password">{formatCode(session.password, 4)}</div>
                      </div>
                    </div>
                  </div>

                  {/* Room Connection Indicators */}
                  <div
                    data-testid="collab-connection-status"
                    className={`p-3.5 rounded-2xl flex items-center gap-3 border ${
                      live.signalingConnected && !waitingForHost
                        ? (darkMode ? 'bg-green-950/20 border-green-900 text-green-300' : 'bg-green-50/50 border-green-200 text-green-700')
                        : (darkMode ? 'bg-amber-950/20 border-amber-900 text-amber-300' : 'bg-amber-50/50 border-amber-200 text-amber-700')
                    }`}
                  >
                    {live.signalingConnected ? <Wifi className="w-5 h-5 animate-pulse" /> : <WifiOff className="w-5 h-5" />}
                    <div>
                      <div className="text-xs font-bold">
                        {live.signalingConnected
                          ? waitingForHost
                            ? tr('collabWaitingForHost')
                            : p2pText.connectedLive
                          : signalingError
                            ? tr('collabSignalingUnreachable')
                            : live.everConnected
                              ? tr('collabReconnecting')
                              : p2pText.connectingToSignaling}
                      </div>
                      <div className="text-[10px] opacity-75">
                        {noPeersHint ? tr('collabNoPeersYet') : `${peerCount} ${p2pText.peersInChannel}`}
                      </div>
                    </div>
                  </div>

                  {onOtherDoc && (
                    <div className={`p-3 rounded-2xl text-xs leading-relaxed border ${darkMode ? 'bg-zinc-950/40 border-zinc-800 text-gray-400' : 'bg-blue-50/50 border-blue-100 text-gray-600'}`}>
                      {tr('collabOtherDocOpen', { title: sharedDoc?.title || tr('collabSharedDocTitle') })}{' '}
                      <button onClick={() => handleOpenDoc(session.docId)} className="text-blue-500 hover:underline font-semibold">
                        {tr('collabOpenSharedDoc')}
                      </button>
                    </div>
                  )}

                  {nameField}

                  {/* Peer List */}
                  {live.participants.length > 0 && (
                    <div>
                      <div className="text-xs font-bold uppercase tracking-wider mb-2 text-gray-500">{p2pText.connectedPeers}</div>
                      <div className="space-y-1.5 max-h-36 overflow-y-auto" data-testid="collab-participants">
                        {live.participants.map((p) => (
                          <div key={p.id} className={`flex items-center gap-3 p-2 rounded-xl text-xs ${
                            darkMode ? 'bg-zinc-800/60' : 'bg-gray-100/60'
                          }`}>
                            <div className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[10px] font-bold" style={{ backgroundColor: p.color }}>
                              {(p.name[0] || '?').toUpperCase()}
                            </div>
                            <span className="font-medium">{p.name} {p.isSelf ? `(${tr('collabYou')})` : ''}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <button
                    onClick={() => {
                      leaveSession();
                    }}
                    className="w-full py-3 rounded-xl font-bold bg-red-600 hover:bg-red-700 text-white transition-all transform active:scale-95 shadow"
                  >
                    {p2pText.disconnectStop}
                  </button>
                </div>
              )}
            </div>
          ) : (
            /* Direct QR Code Clone Panel (AirDrop Clone) */
            <div className="text-center">
              {qrAction === 'menu' && (
                <div className="space-y-4">
                  <p className={`text-xs leading-relaxed mb-4 ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                    {p2pText.transferDirectly}
                  </p>

                  {qrError && (
                    <div className="p-4 rounded-xl border border-red-500 bg-red-500/10 text-red-500 text-xs leading-relaxed" role="alert">
                      {qrError}
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-4">
                    <button
                      onClick={startQrSend}
                      className="p-5 rounded-2xl border hover:border-blue-500 transition-all flex flex-col items-center gap-2 group"
                    >
                      <div className="w-12 h-12 bg-blue-500/10 text-blue-500 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform">
                        <QrCode className="w-6 h-6" />
                      </div>
                      <div className="font-bold text-xs">{p2pText.sendDocument}</div>
                      <div className="text-[9px] opacity-60">{p2pText.generateSharingQr}</div>
                    </button>

                    <button
                      onClick={startCameraScanner}
                      className="p-5 rounded-2xl border hover:border-blue-500 transition-all flex flex-col items-center gap-2 group"
                    >
                      <div className="w-12 h-12 bg-indigo-500/10 text-indigo-500 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform">
                        <Camera className="w-6 h-6" />
                      </div>
                      <div className="font-bold text-xs">{p2pText.scanImport}</div>
                      <div className="text-[9px] opacity-60">{p2pText.openCamera}</div>
                    </button>
                  </div>
                </div>
              )}

              {/* QR Sending Frame */}
              {qrAction === 'send' && qrCodeUrl && (
                <div className="space-y-4">
                  <div className="text-xs font-bold uppercase tracking-wider text-gray-500">{p2pText.scanThisQr}</div>
                  <div className="bg-white p-4 rounded-3xl inline-block shadow-lg mx-auto">
                    <img src={qrCodeUrl} alt={tr('qrQrAlt')} className="w-56 h-56" />
                  </div>
                  <div>
                    <div className="text-[10px] uppercase opacity-55">{tr('qrTransferCodeLabel')}</div>
                    <div className="font-mono font-bold text-sm tracking-wider mt-0.5 select-all" data-testid="qr-transfer-code">{transferCodeText}</div>
                  </div>
                  <p className="text-[10px] text-gray-500 animate-pulse">{p2pText.waitingForPeer}</p>
                  <button
                    onClick={() => {
                      stopQrSession();
                      setQrAction('menu');
                    }}
                    className={`w-full py-2.5 rounded-xl text-xs font-semibold ${
                      darkMode ? 'bg-zinc-800 text-white' : 'bg-gray-200 text-gray-700'
                    }`}
                  >
                    {p2pText.cancelShare}
                  </button>
                </div>
              )}

              {/* QR Receiving Scanner Frame */}
              {qrAction === 'receive' && (
                <div className="space-y-4">
                  <div className="text-xs font-bold uppercase tracking-wider text-gray-500">{p2pText.pointCamera}</div>

                  {scanError ? (
                    <div className="p-4 rounded-xl border border-red-500 bg-red-500/10 text-red-500 text-xs leading-relaxed" role="alert">
                      {scanError}
                    </div>
                  ) : null}
                  {!streamRef.current && scanError ? null : (
                    <div className="relative aspect-video rounded-3xl overflow-hidden border-2 border-dashed border-indigo-500 bg-black">
                      <video ref={videoRef} className="w-full h-full object-cover" muted />
                      <canvas ref={canvasRef} className="hidden" />
                      <div className="absolute inset-0 border-4 border-indigo-500/20 pointer-events-none flex items-center justify-center">
                        <div className="w-48 h-48 border-2 border-indigo-400 rounded-2xl opacity-60 relative animate-pulse">
                          <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,1)]"></div>
                        </div>
                      </div>
                    </div>
                  )}

                  <input ref={fileInputRef} type="file" accept="image/*" className="hidden" data-testid="qr-image-input" onChange={e => void handleQrImage(e.target.files?.[0])} />
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full py-2.5 rounded-xl text-xs font-semibold border hover:border-blue-500 transition-all flex items-center justify-center gap-1.5"
                  >
                    <ImageUp className="w-4 h-4" /> {tr('qrUploadImage')}
                  </button>

                  <div className="text-left">
                    <label htmlFor="qr-manual-code" className={labelClass}>{tr('qrManualCode')}</label>
                    <div className="flex gap-2">
                      <input
                        id="qr-manual-code"
                        type="text"
                        value={manualCode}
                        onChange={e => setManualCode(e.target.value.toUpperCase())}
                        onKeyDown={e => e.key === 'Enter' && handleManualCode()}
                        placeholder="XXXX-XXXX-XXXX-XXXX-XXXX-XXXX"
                        autoComplete="off"
                        spellCheck={false}
                        className={`${smallInputClass} font-mono tracking-wider text-center`}
                      />
                      <button
                        onClick={handleManualCode}
                        disabled={!manualCode.trim()}
                        className="px-4 py-2 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        {tr('qrConnect')}
                      </button>
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      stopCameraScanner();
                      setQrAction('menu');
                    }}
                    className={`w-full py-2.5 rounded-xl text-xs font-semibold ${
                      darkMode ? 'bg-zinc-800 text-white' : 'bg-gray-200 text-gray-700'
                    }`}
                  >
                    {p2pText.cancelScanner}
                  </button>
                </div>
              )}

              {/* P2P Syncing in Progress */}
              {qrAction === 'transferring' && (
                <div className="space-y-5 py-6 flex flex-col items-center">
                  <RefreshCw className="w-10 h-10 text-blue-500 animate-spin" />
                  <div>
                    <div className="font-bold text-sm">{p2pText.synchronizingDoc}</div>
                    <div className="text-[10px] text-gray-500 mt-1">{p2pText.exchangingKeys}</div>
                  </div>

                  <div className="w-full bg-gray-200 dark:bg-zinc-800 h-2 rounded-full overflow-hidden">
                    <div className="bg-blue-600 h-full transition-all duration-300" style={{ width: `${transferProgress}%` }}></div>
                  </div>
                  <button
                    onClick={() => {
                      stopQrSession();
                      setQrAction('menu');
                    }}
                    className={`w-full py-2.5 rounded-xl text-xs font-semibold ${
                      darkMode ? 'bg-zinc-800 text-white' : 'bg-gray-200 text-gray-700'
                    }`}
                  >
                    {p2pText.cancelShare}
                  </button>
                </div>
              )}

              {/* Direct QR Success Frame */}
              {qrAction === 'success' && (
                <div className="space-y-4 py-6 text-center" data-testid="qr-success">
                  <div className="w-16 h-16 bg-green-500/10 text-green-500 rounded-full flex items-center justify-center mx-auto mb-2">
                    <CheckCircle className="w-10 h-10" />
                  </div>
                  <div>
                    <div className="font-bold text-sm">{p2pText.transferCompleted}</div>
                    <p className="text-[10px] text-gray-500 mt-1">{qrRole === 'receiver' ? p2pText.e2eeSecured : tr('qrSentSuccess')}</p>
                  </div>
                  <button
                    onClick={() => {
                      setQrAction('menu');
                      if (qrRole === 'receiver') onClose();
                    }}
                    className="px-6 py-2.5 bg-green-600 hover:bg-green-700 text-white text-xs font-semibold rounded-xl shadow-md"
                  >
                    {p2pText.done}
                  </button>
                </div>
              )}

            </div>
          )}
        </div>

      </div>
    </div>
  );
};

export default CollaborationDialog;

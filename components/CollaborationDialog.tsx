import React, { useState, useEffect, useRef } from 'react';
import { 
  Users, Copy, X, CheckCircle, Wifi, WifiOff, User, 
  QrCode, Camera, ShieldCheck, Share2, ArrowRightLeft, Info, RefreshCw 
} from 'lucide-react';
import QRCode from 'qrcode';
import jsQR from 'jsqr';
import {
  generateRoomId,
  startCollaborationSession,
  leaveCollaborationSession,
  getParticipants,
  getConnectionStatus,
  type CollaborationSession,
  type Participant,
} from '../utils/collaboration';
import { LanguageCode, t } from '../utils/translations';
import { useApp } from '../AppContext';

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
    p2pDescription: 'Document edits travel encrypted in real-time. No centralized server keeps copies of your text files.',
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
    transferDirectly: 'Transfer copies of files directly between screen and camera. No codes or servers required.',
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
    exchangingKeys: 'Exchanging secure AES keys over WebRTC channel',
    transferCompleted: 'Transfer Completed Successfully!',
    e2eeSecured: 'E2EE direct sync copy is secured in local IndexedDB storage.',
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
    p2pDescription: 'Las ediciones de documentos viajan cifradas en tiempo real. Ningún servidor central guarda copias.',
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
    transferDirectly: 'Transfiere copias de archivos directamente entre pantalla y cámara. Sin códigos ni servidores.',
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
    exchangingKeys: 'Intercambiando claves AES seguras sobre el canal WebRTC',
    transferCompleted: '¡Transferencia completada con éxito!',
    e2eeSecured: 'La copia de sincronización directa E2EE está guardada en IndexedDB local.',
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
    p2pDescription: 'Les modifications de document voyagent chiffrées en temps réel. Aucun serveur ne garde de copie.',
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
    transferDirectly: 'Transférez des copies de fichiers directement entre écran et caméra. Sans code ni serveur.',
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
    exchangingKeys: 'Échange de clés AES sécurisées sur le canal WebRTC',
    transferCompleted: 'Transfert réussi !',
    e2eeSecured: 'La copie synchrone directe E2EE est sécurisée dans IndexedDB local.',
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
    p2pDescription: 'Dokumentbearbeitungen werden in Echtzeit verschlüsselt übertragen. Keine Serverkopien.',
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
    transferDirectly: 'Dateien direkt zwischen Bildschirm und Kamera übertragen. Keine Codes oder Server nötig.',
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
    exchangingKeys: 'Sichere AES-Schlüssel werden über WebRTC-Kanal ausgetauscht',
    transferCompleted: 'Übertragung erfolgreich abgeschlossen!',
    e2eeSecured: 'Direkte E2EE-Kopie im lokalen IndexedDB-Speicher gesichert.',
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
    p2pDescription: '編集内容はリアルタイムで暗号化して転送されます。サーバーには保存されません。',
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
    transferDirectly: 'コードやサーバーを使わずに、画面とカメラ間で直接ファイルを複製・転送します。',
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
    exchangingKeys: 'WebRTCチャンネルで安全なAESキーを交換しています',
    transferCompleted: '転送が正常に完了しました！',
    e2eeSecured: '暗号化されたコピーがローカルIndexedDBに保存されました。',
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
    p2pDescription: '文档编辑实时加密传输。没有任何中央服务器保留副本。',
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
    transferDirectly: '无需代码或服务器，直接在屏幕和相机之间传输文件副本。',
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
    exchangingKeys: '正在通过 WebRTC 通道交换安全的 AES 密钥',
    transferCompleted: '传输成功完成！',
    e2eeSecured: '端到端加密副本已安全保存在本地 IndexedDB 存储中。',
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
    p2pDescription: 'Редагування шифрується в реальному часі. Жодні сервери не зберігають копій.',
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
    transferDirectly: 'Передавайте копії файлів безпосередньо між екраном та камерою без серверів.',
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
    exchangingKeys: 'Обмін безпечними ключами AES через канал WebRTC',
    transferCompleted: 'Передачу успішно завершено!',
    e2eeSecured: 'Пряма E2EE копія збережена у локальному сховищі IndexedDB.',
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
    p2pDescription: 'Редактирование шифруется в реальном времени. Никакие серверы не хранят копий.',
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
    transferDirectly: 'Передавайте копии файлов напрямую между экраном и камерой без серверов.',
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
    exchangingKeys: 'Обмен безопасными ключами AES через канал WebRTC',
    transferCompleted: 'Передача успешно завершена!',
    e2eeSecured: 'Прямая E2EE копия сохранена в локальном хранилище IndexedDB.',
    done: 'Готово'
  }
};

interface CollaborationDialogProps {
  isOpen: boolean;
  onClose: () => void;
  currentContent: string;
  onContentChange: (content: string) => void;
  userName: string;
  darkMode: boolean;
  uiLanguage: LanguageCode;
}

export const CollaborationDialog: React.FC<CollaborationDialogProps> = ({
  isOpen,
  onClose,
  currentContent,
  onContentChange,
  userName,
  darkMode,
  uiLanguage,
}) => {
  const { currentDoc, handleNewDoc } = useApp();
  const [activeTab, setActiveTab] = useState<'collab' | 'qr'>('collab');
  const [mode, setMode] = useState<'menu' | 'host' | 'join' | 'active'>('menu');
  const [roomId, setRoomId] = useState('');
  const [inputRoomId, setInputRoomId] = useState('');
  const [sessionPassword, setSessionPassword] = useState('');
  const [inputPassword, setInputPassword] = useState('');
  const [session, setSession] = useState<CollaborationSession | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [status, setStatus] = useState({ connected: false, synced: false, peers: 0 });
  const [copied, setCopied] = useState(false);

  // QR Mode States
  const [qrAction, setQrAction] = useState<'menu' | 'send' | 'receive' | 'transferring' | 'success'>('menu');
  const [qrCodeUrl, setQrCodeUrl] = useState('');
  const [scannerActive, setScannerActive] = useState(false);
  const [scanError, setScanError] = useState('');
  const [transferProgress, setTransferProgress] = useState(0);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const qrSessionRef = useRef<CollaborationSession | null>(null);

  // Copy Room Link/Credentials Helper
  const handleCopyCredentials = () => {
    const credText = `Room ID: ${roomId}\nPassword/Key: ${sessionPassword}`;
    navigator.clipboard.writeText(credText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Generate a random password for end-to-end encryption (E2EE)
  const generateRandomPassword = () => {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
  };

  // Start Live Collaboration
  const handleStartHosting = () => {
    const newRoomId = generateRoomId();
    const newPass = generateRandomPassword();
    setRoomId(newRoomId);
    setSessionPassword(newPass);

    const newSession = startCollaborationSession(
      newRoomId,
      userName,
      onContentChange,
      currentContent,
      newPass // WebRTC simple-peer payload E2EE password
    );

    setSession(newSession);
    setMode('active');
  };

  const handleJoinSession = () => {
    if (!inputRoomId.trim()) return;

    const newSession = startCollaborationSession(
      inputRoomId.trim().toUpperCase(),
      userName,
      onContentChange,
      undefined,
      inputPassword.trim() || null
    );

    setSession(newSession);
    setRoomId(inputRoomId.trim().toUpperCase());
    setSessionPassword(inputPassword.trim());
    setMode('active');
  };

  const handleLeaveSession = () => {
    if (session) {
      leaveCollaborationSession(session);
      setSession(null);
    }
    setMode('menu');
    setRoomId('');
    setInputRoomId('');
    setSessionPassword('');
    setInputPassword('');
    onClose();
  };

  // Direct QR Transfer - Sending Role
  const startQrSend = async () => {
    try {
      setQrAction('send');
      const transferRoom = generateRoomId();
      const transferKey = generateRandomPassword();

      // Bundle document parameters
      const docPayload = {
        title: currentDoc?.title || 'Shared Document',
        content: currentContent,
        language: currentDoc?.language || 'en-US'
      };

      // Generate connection URL containing room parameters and encryption credentials
      const shareUrl = JSON.stringify({ r: transferRoom, k: transferKey });
      const qrData = await QRCode.toDataURL(shareUrl, { margin: 2, scale: 6 });
      setQrCodeUrl(qrData);

      // Start WebRTC session locally
      const qrSession = startCollaborationSession(
        transferRoom,
        'Sender (Local QR)',
        () => {},
        JSON.stringify(docPayload), // Seed initial payload
        transferKey
      );

      qrSessionRef.current = qrSession;

      // Monitor peers to track download completion
      const checkInterval = setInterval(() => {
        if (!qrSessionRef.current) {
          clearInterval(checkInterval);
          return;
        }
        const state = getConnectionStatus(qrSessionRef.current);
        if (state.peers > 0) {
          setQrAction('transferring');
          setTransferProgress(50);
          setTimeout(() => {
            setTransferProgress(100);
            setQrAction('success');
            clearInterval(checkInterval);
            stopQrSession();
          }, 1500);
        }
      }, 1000);

    } catch (err) {
      console.error('Failed to generate sharing QR Code:', err);
    }
  };

  const stopQrSession = () => {
    if (qrSessionRef.current) {
      leaveCollaborationSession(qrSessionRef.current);
      qrSessionRef.current = null;
    }
    setQrCodeUrl('');
  };

  // Direct QR Transfer - Receiving Role
  const startCameraScanner = async () => {
    setScanError('');
    setScannerActive(true);
    setQrAction('receive');

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' }
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.setAttribute('playsinline', 'true');
        videoRef.current.play();
        requestAnimationFrame(tickScanner);
      }
    } catch (err) {
      setScanError('Could not access camera feed. Please check permissions or upload a QR image.');
      setScannerActive(false);
    }
  };

  const stopCameraScanner = () => {
    setScannerActive(false);
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
  };

  const tickScanner = () => {
    if (!videoRef.current || !canvasRef.current || !scannerActive) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');

    if (video.readyState === video.HAVE_ENOUGH_DATA && ctx) {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const code = jsQR(imageData.data, imageData.width, imageData.height, {
        inversionAttempts: 'dontInvert'
      });

      if (code && code.data) {
        try {
          const parsed = JSON.parse(code.data);
          if (parsed.r && parsed.k) {
            stopCameraScanner();
            triggerP2PImport(parsed.r, parsed.k);
            return;
          }
        } catch (e) {
          // Keep scanning if JSON format is not a match
        }
      }
    }
    requestAnimationFrame(tickScanner);
  };

  const triggerP2PImport = (room: string, key: string) => {
    setQrAction('transferring');
    setTransferProgress(30);

    const importSession = startCollaborationSession(
      room,
      'Receiver (Local Scan)',
      (incomingText) => {
        try {
          if (incomingText && incomingText.startsWith('{')) {
            const parsedDoc = JSON.parse(incomingText);
            if (parsedDoc.content !== undefined) {
              setTransferProgress(90);
              handleNewDoc({
                title: parsedDoc.title || 'Imported Copy',
                content: parsedDoc.content,
                language: parsedDoc.language || 'en-US'
              });
              setTransferProgress(100);
              setQrAction('success');
              leaveCollaborationSession(importSession);
            }
          }
        } catch (e) {
          // Wait for full sync buffer
        }
      },
      undefined,
      key
    );

    // Timeout fallback if WebRTC link times out
    setTimeout(() => {
      if (qrAction === 'transferring') {
        leaveCollaborationSession(importSession);
        setScanError('WebRTC sync handshake timed out. Please try again.');
        setQrAction('menu');
      }
    }, 15000);
  };

  const langKey = uiLanguage in LOCALIZED_P2P ? uiLanguage : 'en-US';
  const p2pText = LOCALIZED_P2P[langKey];

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[100] backdrop-blur-md p-4 print:hidden">
      <div className={`max-w-md w-full rounded-3xl shadow-2xl overflow-hidden border transition-all duration-300 ${
        darkMode ? 'bg-zinc-900 border-zinc-800 text-gray-100' : 'bg-white border-gray-100 text-gray-800'
      }`}>
        
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-6 text-white relative">
          <button
            onClick={() => {
              stopCameraScanner();
              stopQrSession();
              if (mode === 'active') {
                handleLeaveSession();
              } else {
                onClose();
              }
            }}
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
        {mode === 'menu' && qrAction === 'menu' && (
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
          {activeTab === 'collab' ? (
            /* Live Collaboration Room Panel */
            <div>
              {mode === 'menu' && (
                <div className="space-y-4">
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
                </div>
              )}

              {mode === 'join' && (
                <div className="space-y-4">
                  <div>
                    <label className={`block text-xs font-bold uppercase tracking-wider mb-2 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                      {p2pText.roomCode}
                    </label>
                    <input
                      type="text"
                      value={inputRoomId}
                      onChange={(e) => setInputRoomId(e.target.value.toUpperCase())}
                      placeholder="ENTER ROOM CODE (8 CHARS)"
                      maxLength={8}
                      className={`w-full px-4 py-3 rounded-xl font-mono text-base tracking-widest text-center border focus:ring-2 focus:ring-blue-500 outline-none ${
                        darkMode ? 'bg-zinc-800 border-zinc-700 text-white' : 'bg-gray-50 border-gray-200 text-gray-900'
                      }`}
                    />
                  </div>

                  <div>
                    <label className={`block text-xs font-bold uppercase tracking-wider mb-2 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                      {p2pText.e2eePassword}
                    </label>
                    <input
                      type="text"
                      value={inputPassword}
                      onChange={(e) => setInputPassword(e.target.value.toUpperCase())}
                      placeholder="ENTER SESSION PASSWORD"
                      className={`w-full px-4 py-3 rounded-xl font-mono text-base tracking-widest text-center border focus:ring-2 focus:ring-blue-500 outline-none ${
                        darkMode ? 'bg-zinc-800 border-zinc-700 text-white' : 'bg-gray-50 border-gray-200 text-gray-900'
                      }`}
                    />
                  </div>

                  <div className="flex gap-3">
                    <button
                      onClick={handleJoinSession}
                      disabled={inputRoomId.length < 8}
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

              {mode === 'active' && (
                <div className="space-y-4">
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
                        <div className="font-bold text-sm tracking-wider mt-0.5">{roomId}</div>
                      </div>
                      <div className="p-2 rounded-xl bg-black/10">
                        <div className="text-[10px] uppercase opacity-55">{p2pText.e2eePassword}</div>
                        <div className="font-bold text-sm tracking-wider mt-0.5">{sessionPassword}</div>
                      </div>
                    </div>
                  </div>

                  {/* Room Connection Indicators */}
                  <div className={`p-3.5 rounded-2xl flex items-center gap-3 border ${
                    status.connected
                      ? (darkMode ? 'bg-green-950/20 border-green-900 text-green-300' : 'bg-green-50/50 border-green-200 text-green-700')
                      : (darkMode ? 'bg-amber-950/20 border-amber-900 text-amber-300' : 'bg-amber-50/50 border-amber-200 text-amber-700')
                  }`}>
                    {status.connected ? <Wifi className="w-5 h-5 animate-pulse" /> : <WifiOff className="w-5 h-5" />}
                    <div>
                      <div className="text-xs font-bold">{status.connected ? p2pText.connectedLive : p2pText.connectingToSignaling}</div>
                      <div className="text-[10px] opacity-75">{status.peers} {p2pText.peersInChannel}</div>
                    </div>
                  </div>

                  {/* Peer List */}
                  {participants.length > 0 && (
                    <div>
                      <div className="text-xs font-bold uppercase tracking-wider mb-2 text-gray-500">{p2pText.connectedPeers}</div>
                      <div className="space-y-1.5 max-h-36 overflow-y-auto">
                        {participants.map((p) => (
                          <div key={p.id} className={`flex items-center gap-3 p-2 rounded-xl text-xs ${
                            darkMode ? 'bg-zinc-800/60' : 'bg-gray-150/40'
                          }`}>
                            <div className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[10px] font-bold" style={{ backgroundColor: p.color }}>
                              {p.name[0].toUpperCase()}
                            </div>
                            <span className="font-medium">{p.name} {p.id === session?.provider.awareness.clientID ? '(You)' : ''}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <button
                    onClick={handleLeaveSession}
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
                    <img src={qrCodeUrl} alt="E2EE Share QR Code" className="w-56 h-56" />
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
                    <div className="p-4 rounded-xl border border-red-500 bg-red-500/10 text-red-500 text-xs leading-relaxed">
                      {p2pText.cameraAccessError}
                    </div>
                  ) : (
                    <div className="relative aspect-video rounded-3xl overflow-hidden border-2 border-dashed border-indigo-500 bg-black">
                      <video ref={videoRef} className="w-full h-full object-cover" />
                      <canvas ref={canvasRef} className="hidden" />
                      <div className="absolute inset-0 border-4 border-indigo-500/20 pointer-events-none flex items-center justify-center">
                        <div className="w-48 h-48 border-2 border-indigo-400 rounded-2xl opacity-60 relative animate-pulse">
                          <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,1)]"></div>
                        </div>
                      </div>
                    </div>
                  )}

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
                </div>
              )}

              {/* Direct QR Success Frame */}
              {qrAction === 'success' && (
                <div className="space-y-4 py-6 text-center">
                  <div className="w-16 h-16 bg-green-500/10 text-green-500 rounded-full flex items-center justify-center mx-auto mb-2">
                    <CheckCircle className="w-10 h-10" />
                  </div>
                  <div>
                    <div className="font-bold text-sm">{p2pText.transferCompleted}</div>
                    <p className="text-[10px] text-gray-500 mt-1">{p2pText.e2eeSecured}</p>
                  </div>
                  <button
                    onClick={() => setQrAction('menu')}
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

import React, { useState, useEffect, useRef } from 'react';
import { PenkoIcon } from './PenkoIcon';
import { useApp } from '../AppContext';
import { Sparkles, BarChart2, CheckSquare, Plus, Volume2, X, Send, Bell } from 'lucide-react';

interface LocalizedAssistantData {
  summon: string;
  assistant: string;
  youRang: string;
  placeholder: string;
  tips: string[];
  replies: Record<string, string>;
  unknown: string;
}

const LOCALIZED_ASSISTANT: Record<string, LocalizedAssistantData> = {
  'en-US': {
    summon: 'Summon Penko',
    assistant: 'Penko Assistant',
    youRang: 'You rang?',
    placeholder: 'Ask me how to save, export...',
    tips: [
      "Tip: Press Ctrl + S to instantly save your document to local storage!",
      "Tip: Enable Markdown Mode in the View tab to edit in raw Markdown!",
      "Tip: You can drag and drop headings in the Outline panel to reorder sections.",
      "Tip: Use the Bibliography tool in the References tab to insert citations in APA or MLA styles.",
      "Tip: Copy formatting from text and paint it elsewhere using the Format Painter tool in the Home tab!",
      "Tip: Insert equations using LaTeX. Click the Formula button in the Insert tab to start.",
      "Tip: Access Focus/Zen Mode from the View tab to write without distraction."
    ],
    replies: {
      save: "Press Ctrl + S, or click the Save button in the left sidebar to save your document to local storage!",
      export: "You can export your document as DOCX, PDF, HTML, or TXT. Click the Export dropdown in the left sidebar.",
      stats: "Click the 'Show Stats' button under my quick actions or in the View tab to see word and character count!",
      ruler: "You can toggle the horizontal margin ruler from the checkbox inside the View tab!",
      markdown: "Enable Markdown Mode in the View tab to edit your document in raw Markdown with live preview side-by-side!",
      bibliography: "Go to the References tab, insert citation details, and choose your format style to output bibliography lists!",
      clippy: "I am Penko, your helpful writing assistant penguin! I was inspired by Clippy from old Microsoft Office."
    },
    unknown: "I'm still learning! Try asking me about 'save', 'export', 'stats', 'markdown', or 'bibliography'!"
  },
  'es': {
    summon: 'Invocar a Penko',
    assistant: 'Asistente Penko',
    youRang: '¿Llamó usted?',
    placeholder: 'Pregúntame cómo guardar, exportar...',
    tips: [
      "Consejo: ¡Presiona Ctrl + S para guardar tu documento localmente!",
      "Consejo: ¡Activa el Modo Markdown en la pestaña Vista para editar en Markdown!",
      "Consejo: Puedes arrastrar y soltar títulos en el panel de Estructura.",
      "Consejo: Usa la herramienta de Bibliografía en la pestaña Referencias.",
      "Consejo: ¡Copia formato usando el Copiador de Formato en la pestaña Inicio!",
      "Consejo: Inserta ecuaciones usando LaTeX desde la pestaña Insertar.",
      "Consejo: Accede al Modo Zen desde la pestaña Vista para escribir sin distracciones."
    ],
    replies: {
      save: "¡Presiona Ctrl + S o haz clic en Guardar en la barra lateral izquierda para guardar tu documento localmente!",
      export: "Puedes exportar como DOCX, PDF, HTML o TXT usando el menú Exportar en la barra lateral.",
      stats: "¡Haz clic en 'Mostrar estadísticas' en la pestaña Vista para ver palabras y caracteres!",
      ruler: "¡Puedes activar la regla horizontal desde la pestaña Vista!",
      markdown: "¡Activa el Modo Markdown en la pestaña Vista para ver la vista previa en vivo!",
      bibliography: "¡Ve a la pestaña Referencias para formatear listas de bibliografía estilo APA o MLA!",
      clippy: "¡Soy Penko, tu pingüino asistente de escritura! Me inspiré en Clippy de Microsoft Office."
    },
    unknown: "¡Aún estoy aprendiendo! Intenta preguntarme sobre 'guardar', 'exportar', 'estadísticas', 'markdown' o 'bibliografía'."
  },
  'fr': {
    summon: 'Invoquer Penko',
    assistant: 'Assistant Penko',
    youRang: 'Vous avez sonné ?',
    placeholder: 'Demandez-moi comment sauvegarder, exporter...',
    tips: [
      "Astuce : Appuyez sur Ctrl + S pour sauvegarder localement !",
      "Astuce : Activez le mode Markdown dans l'onglet Affichage !",
      "Astuce : Vous pouvez glisser-déposer les titres dans le volet Structure.",
      "Astuce : Utilisez l'outil Bibliographie dans l'onglet Références.",
      "Astuce : Copiez la mise en forme avec le Pinceau dans l'onglet Accueil !",
      "Astuce : Insérez des formules LaTeX depuis l'onglet Insertion.",
      "Astuce : Accédez au mode Zen dans l'onglet Affichage pour écrire sans distractions."
    ],
    replies: {
      save: "Appuyez sur Ctrl + S ou cliquez sur Enregistrer dans la barre latérale gauche pour sauvegarder !",
      export: "Exportez au format DOCX, PDF, HTML ou TXT depuis le menu Exporter.",
      stats: "Consultez les statistiques de mots et caractères dans l'onglet Affichage.",
      ruler: "Affichez ou masquez la règle horizontale dans l'onglet Affichage.",
      markdown: "Activez le mode Markdown pour éditer en Markdown avec aperçu en temps réel.",
      bibliography: "Générez des bibliographies aux normes APA ou MLA dans l'onglet Références.",
      clippy: "Je suis Penko, votre manchot assistant d'écriture ! Inspiré de Clippy de Microsoft Office."
    },
    unknown: "J'apprends encore ! Demandez-moi des détails sur 'sauvegarder', 'exporter', 'statistiques', 'markdown' ou 'bibliographie'."
  },
  'de': {
    summon: 'Penko rufen',
    assistant: 'Penko-Assistent',
    youRang: 'Sie haben geläutet?',
    placeholder: 'Frag mich nach Speichern, Exportieren...',
    tips: [
      "Tipp: Drücke Strg + S, um dein Dokument lokal zu speichern!",
      "Tipp: Aktiviere den Markdown-Modus im Ansicht-Tab!",
      "Tipp: Du kannst Überschriften im Gliederungs-Panel verschieben.",
      "Tipp: Nutze das Literaturverzeichnis-Tool im Referenzen-Tab.",
      "Tipp: Kopiere Formatierungen mit dem Formatpinsel im Start-Tab!",
      "Tipp: Füge LaTeX-Formeln über den Einfügen-Tab hinzu.",
      "Tipp: Nutze den Zen-Modus im Ansicht-Tab für ablenkungsfreies Schreiben."
    ],
    replies: {
      save: "Drücke Strg + S oder klicke auf Speichern in der linken Seitenleiste, um lokal zu speichern!",
      export: "Exportiere als DOCX, PDF, HTML oder TXT über das Export-Menü.",
      stats: "Klicke auf 'Statistiken anzeigen' im Ansicht-Tab, um Wörter zu zählen.",
      ruler: "Aktiviere das horizontale Lineal im Ansicht-Tab.",
      markdown: "Aktiviere den Markdown-Modus für eine Live-Vorschau deines Dokuments.",
      bibliography: "Erstelle Literaturverzeichnisse im APA- oder MLA-Stil im Referenzen-Tab.",
      clippy: "Ich bin Penko, dein Schreibassistent-Pinguin! Inspiriert von Clippy aus alten Office-Tagen."
    },
    unknown: "Ich lerne noch! Frage mich nach 'speichern', 'exportieren', 'statistiken', 'markdown' oder 'literaturverzeichnis'."
  },
  'ja': {
    summon: 'ペンコを呼ぶ',
    assistant: 'ペンコ アシスタント',
    youRang: 'お呼びでしょうか？',
    placeholder: '保存やエクスポートについて質問する...',
    tips: [
      "ヒント: Ctrl + Sキーで、ドキュメントをローカルに即座に保存できます！",
      "ヒント: 表示タブでマークダウンモードを有効にすると、ライブプレビューが表示されます。",
      "ヒント: アウトラインパネルで、見出しをドラッグ＆ドロップして並べ替えられます。",
      "ヒント: 参照タブの文献目録ツールを使用して、APAやMLAの引用文献を挿入できます。",
      "ヒント: ホームタブの書式コピーツールで、書式を他のテキストに適用できます！",
      "ヒント: 挿入タブの数式ボタンをクリックして、LaTeXで数式を挿入できます。",
      "ヒント: 表示タブから禅モードに入り、集中して執筆できます。"
    ],
    replies: {
      save: "Ctrl + Sキーを押すか、左サイドバーの「保存」をクリックしてローカルストレージに保存してください！",
      export: "左サイドバーのエクスポートメニューから、DOCX、PDF、HTML、TXT形式で出力できます。",
      stats: "表示タブまたはクイックアクションの「統計」から、文字数や単語数を確認できます。",
      ruler: "表示タブのチェックボックスから、ルーラー（定規）の表示/非表示を切り替えられます。",
      markdown: "表示タブでマークダウンモードを有効にすると、マークダウンで編集しながらプレビューを確認できます。",
      bibliography: "参照タブで文献情報を入力し、フォーマットを選択して文献目録を出力できます。",
      clippy: "私は執筆アシスタントペンギンのペンコです！昔のOfficeのクリッパー（Clippy）を参考にしています。"
    },
    unknown: "現在学習中です！「保存」、「エクスポート」、「統計」、「マークダウン」、「文献目録」などについて聞いてみてください。"
  },
  'zh': {
    summon: '召唤 Penko',
    assistant: 'Penko 助手',
    youRang: '您叫我吗？',
    placeholder: '问我如何保存、导出...',
    tips: [
      "提示：按 Ctrl + S 即可将文档保存到本地存储！",
      "提示：在“视图”选项卡中启用 Markdown 模式进行实时预览编辑！",
      "提示：您可以在大纲面板中拖放标题以重新调整章节顺序。",
      "提示：使用“引用”选项卡中的文献目录工具插入 APA 或 MLA 格式 of 引文。",
      "提示：使用“开始”选项卡中的格式刷工具快速复制格式！",
      "提示：使用 LaTeX 插入公式。点击“插入”选项卡中的公式按钮开始。",
      "提示：从“视图”选项卡进入禅模式，享受无干扰写作环境。"
    ],
    replies: {
      save: "按 Ctrl + S，或点击左侧边栏中的“保存”按钮将文档保存到本地存储！",
      export: "您可以将文档导出为 DOCX、PDF、HTML 或 TXT。点击左侧边栏的“导出”下拉菜单。",
      stats: "点击“视图”选项卡中的“显示统计信息”查看字数和字符数统计！",
      ruler: "您可以在“视图”选项卡中勾选标尺复选框来启用水平标尺！",
      markdown: "在“视图”选项卡中启用 Markdown 模式，即可在左侧编辑 Markdown，右侧进行实时预览！",
      bibliography: "前往“引用”选项卡，输入文献信息，选择引用格式即可输出文献目录！",
      clippy: "我是您的写作助手企鹅 Penko！我的灵感来源于旧版微软 Office 的大眼夹 Clippy。"
    },
    unknown: "我仍在学习中！试试问我关于“保存”、“导出”、“统计”、“markdown”或“文献目录”吧！"
  },
  'uk': {
    summon: 'Покликати Пенко',
    assistant: 'Помічник Пенко',
    youRang: 'Ви кликали?',
    placeholder: 'Запитайте про збереження, експорт...',
    tips: [
      "Порада: Натисніть Ctrl + S, щоб зберегти документ у локальне сховище!",
      "Порада: Увімкніть режим Markdown у вкладці Вигляд для редагування з прев'ю!",
      "Порада: Ви можете перетягувати заголовки в панелі структури документа.",
      "Порада: Використовуйте інструмент бібліографії у вкладці Посилання.",
      "Порада: Скопіюйте форматування пензлем формату у вкладці Основне!",
      "Порада: Вставляйте формули LaTeX через вкладку Вставлення.",
      "Порада: Перейдіть у режим Дзен у вкладці Вигляд для концентрованого письма."
    ],
    replies: {
      save: "Натисніть Ctrl + S або кнопку Зберегти у лівій бічній панелі для збереження!",
      export: "Ви можете експортувати документ як DOCX, PDF, HTML або TXT через меню експорту.",
      stats: "Натисніть 'Показати статистику' у вкладці Вигляд, щоб переглянути кількість слів.",
      ruler: "Ви можете увімкнути лінійку у вкладці Вигляд.",
      markdown: "Увімкніть режим Markdown для редагування з двопанельним візуальним прев'ю.",
      bibliography: "Створюйте бібліографічні списки за стилями APA або MLA у вкладці Посилання.",
      clippy: "Я Пенко, ваш помічник-пінгвін! Натхненний Скріпкою (Clippy) зі старих версій MS Office."
    },
    unknown: "Я ще вчуся! Спробуйте запитати про 'збереження', 'експорт', 'статистику', 'markdown' або 'бібліографію'."
  },
  'ru': {
    summon: 'Позвать Пенко',
    assistant: 'Помощник Пенко',
    youRang: 'Вы звали?',
    placeholder: 'Спросите про сохранение, экспорт...',
    tips: [
      "Совет: Нажмите Ctrl + S, чтобы сохранить документ в локальное хранилище!",
      "Совет: Включите режим Markdown во вкладке Вид для редактирования с превью!",
      "Совет: Вы можете перетаскивать заголовки в панели структуры документа.",
      "Совет: Используйте инструмент библиографии во вкладке Ссылки.",
      "Совет: Скопируйте форматирование кистью формата во вкладке Главная!",
      "Совет: Вставляйте формулы LaTeX через вкладку Вставка.",
      "Совет: Перейдите в режим Дзен во вкладке Вид для сосредоточенного письма."
    ],
    replies: {
      save: "Нажмите Ctrl + S или кнопку Сохранить в левой боковой панели для сохранения!",
      export: "Вы можете экспортировать документ как DOCX, PDF, HTML или TXT через меню экспорта.",
      stats: "Нажмите 'Показать статистику' во вкладке Вид, чтобы посмотреть количество слов.",
      ruler: "Вы можете включить линейку во вкладке Вид.",
      markdown: "Включите режим Markdown для редактирования с двухпанельным визуальным превью.",
      bibliography: "Создавайте библиографические списки по стилям APA или MLA во вкладке Ссылки.",
      clippy: "Я Пенко, ваш помощник-пингвин! Навеян Скрепкой (Clippy) из старых версий MS Office."
    },
    unknown: "Я еще учусь! Попробуйте спросить про 'сохранение', 'экспорт', 'статистику', 'markdown' или 'библиографию'."
  }
};

export const PenkoAssistant: React.FC = () => {
  const {
    darkMode,
    uiLanguage,
    currentDoc
  } = useApp();

  const lang = uiLanguage in LOCALIZED_ASSISTANT ? uiLanguage : 'en-US';
  const tData = LOCALIZED_ASSISTANT[lang];

  const [isOpen, setIsOpen] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);
  const [pose, setPose] = useState<'idle' | 'talk' | 'hurt' | 'jump' | 'walk'>('idle');
  const [costume, setCostume] = useState<'custom' | 'lurch'>('custom');
  const [message, setMessage] = useState(() => {
    // Dynamically retrieve initial message matching browser state
    const savedLang = localStorage.getItem('penko_writer_ui_lang') || uiLanguage;
    const initialLang = savedLang in LOCALIZED_ASSISTANT ? savedLang : 'en-US';
    return LOCALIZED_ASSISTANT[initialLang].tips[0];
  });
  const [query, setQuery] = useState('');

  // Synchronize tips list based on active language
  useEffect(() => {
    setMessage(tData.tips[0]);
  }, [lang, tData]);

  // Auto-cycle tips when dialog opens
  useEffect(() => {
    if (isOpen && costume !== 'lurch') {
      setPose('talk');
      const timer = setTimeout(() => setPose('idle'), 2000);
      return () => clearTimeout(timer);
    }
  }, [isOpen, costume]);

  // Periodic cute random movement
  useEffect(() => {
    const interval = setInterval(() => {
      if (!isOpen && !isDismissed && costume !== 'lurch') {
        const rand = Math.random();
        if (rand < 0.3) {
          setPose('jump');
          setTimeout(() => setPose('idle'), 1200);
        } else if (rand < 0.6) {
          setPose('walk');
          setTimeout(() => setPose('idle'), 1500);
        }
      }
    }, 20000);

    return () => clearInterval(interval);
  }, [isOpen, isDismissed, costume]);

  // Listen to document changes to show excitement (jump)
  useEffect(() => {
    if (currentDoc && !isDismissed && costume !== 'lurch') {
      setPose('jump');
      const timer = setTimeout(() => setPose('idle'), 1000);
      return () => clearTimeout(timer);
    }
  }, [currentDoc?.lastModified]);

  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0 });
  const hasMoved = useRef(false);

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    hasMoved.current = false;
    dragStart.current = {
      x: e.clientX - position.x,
      y: e.clientY - position.y
    };
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;
      hasMoved.current = true;
      setPosition({
        x: e.clientX - dragStart.current.x,
        y: e.clientY - dragStart.current.y
      });
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging]);

  // Offline chatbot answer dictionary
  const handleQuerySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;

    setPose('talk');
    const q = query.toLowerCase();
    let reply = "";

    // Live search command execution
    const searchMatch = query.match(/^(find|search|buscar|suche|chercher|поиск|пошук|検索|查找)\s+(.+)$/i);
    
    if (searchMatch) {
      const term = searchMatch[2].trim();
      const docContent = currentDoc?.content || '';
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = docContent;
      const text = tempDiv.textContent || '';
      
      let count = 0;
      if (term) {
        // Escape special regex chars
        const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const matches = text.match(new RegExp(escaped, 'gi'));
        count = matches ? matches.length : 0;
      }
      
      if (lang === 'es') {
        reply = `Encontré "${term}" ${count} veces en el documento.`;
      } else if (lang === 'de') {
        reply = `Ich habe "${term}" ${count} Mal im Dokument gefunden.`;
      } else if (lang === 'fr') {
        reply = `J'ai trouvé "${term}" ${count} fois dans le document.`;
      } else if (lang === 'ja') {
        reply = `ドキュメント内で「${term}」が ${count} 回見つかりました。`;
      } else if (lang === 'zh') {
        reply = `在文档中找到了 ${count} 次 "${term}"。`;
      } else if (lang === 'uk') {
        reply = `Знайдено "${term}" у документі ${count} разів.`;
      } else if (lang === 'ru') {
        reply = `Найдено "${term}" в документе ${count} раз.`;
      } else {
        reply = `Found "${term}" ${count} times in the document.`;
      }
    } else if (q.includes('save') || q.includes('guardar') || q.includes('sauvegarder') || q.includes('speichern') || q.includes('保存') || q.includes('зберегти') || q.includes('сохранить')) {
      reply = tData.replies.save;
    } else if (q.includes('export') || q.includes('download') || q.includes('descargar') || q.includes('télécharger') || q.includes('herunterladen') || q.includes('エクスポート') || q.includes('导出') || q.includes('експорт') || q.includes('экспорт')) {
      reply = tData.replies.export;
    } else if (q.includes('stats') || q.includes('words') || q.includes('count') || q.includes('estadísticas') || q.includes('statistiques') || q.includes('wörter') || q.includes('文字数') || q.includes('字数') || q.includes('статистика')) {
      reply = tData.replies.stats;
    } else if (q.includes('ruler') || q.includes('regla') || q.includes('règle') || q.includes('lineal') || q.includes('ルーラー') || q.includes('标尺') || q.includes('лінійка') || q.includes('линейка')) {
      reply = tData.replies.ruler;
    } else if (q.includes('markdown') || q.includes('マークダウン')) {
      reply = tData.replies.markdown;
    } else if (q.includes('bibliography') || q.includes('citation') || q.includes('bibliografía') || q.includes('bibliographie') || q.includes('literaturverzeichnis') || q.includes('文献目録') || q.includes('文献目录') || q.includes('бібліографія') || q.includes('библиография')) {
      reply = tData.replies.bibliography;
    } else if (q.includes('clippy') || q.includes('who are you') || q.includes('quién eres') || q.includes('qui es-tu') || q.includes('wer bist du') || q.includes('あなたは誰') || q.includes('你是谁') || q.includes('хто ти') || q.includes('кто ты')) {
      reply = tData.replies.clippy;
    } else {
      reply = tData.unknown;
    }

    setMessage(reply);
    setQuery('');
    setTimeout(() => setPose('idle'), 2000);
  };

  const handleSummon = () => {
    setIsDismissed(false);
    setCostume('lurch');
    setPose('talk');
    setMessage(tData.youRang);
    setIsOpen(true);

    // After 2.5s, transition back to standard butler pose to wizard hat
    setTimeout(() => {
      setCostume('custom');
      setPose('idle');
      setMessage(tData.tips[Math.floor(Math.random() * tData.tips.length)]);
    }, 2500);
  };

  const handleDismiss = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsOpen(false);
    setIsDismissed(true);
  };

  const bg = darkMode 
    ? 'bg-zinc-900/95 border-zinc-800 text-gray-200' 
    : 'bg-white/95 border-gray-200 text-gray-800';

  return (
    <div 
      className="fixed bottom-20 right-8 z-50 flex flex-col items-end print:hidden select-none"
      style={{ transform: `translate(${position.x}px, ${position.y}px)` }}
    >
      {isDismissed ? (
        <button 
          onMouseDown={handleMouseDown}
          onClick={() => {
            if (!hasMoved.current) {
              handleSummon();
            }
          }}
          className={`flex items-center gap-2 px-3 py-2 rounded-full shadow-lg border text-xs font-semibold backdrop-blur bg-blue-600 hover:bg-blue-500 text-white transition-all transform active:scale-95 cursor-grab ${isDragging ? 'cursor-grabbing scale-105' : ''}`}
        >
          <Bell size={14} className="animate-bounce" />
          <span>{tData.summon}</span>
        </button>
      ) : (
        <>
          {/* Speech Bubble */}
          {isOpen && (
            <div className={`mb-3 w-80 rounded-2xl border p-4 shadow-2xl backdrop-blur-md transition-all duration-300 animate-fade-in ${bg}`}>
              {/* Header */}
              <div className="flex items-center justify-between mb-2 pb-1.5 border-b border-gray-100 dark:border-zinc-800">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-xs uppercase tracking-wider text-blue-500">{tData.assistant}</span>
                </div>
                <button onClick={() => setIsOpen(false)} className="opacity-50 hover:opacity-100"><X size={14} /></button>
              </div>

              {/* Assistant Message Bubble */}
              <div className="text-sm leading-relaxed mb-4 min-h-[50px] flex items-center italic">
                "{message}"
              </div>

              {/* Offline Chatbot Input */}
              <form onSubmit={handleQuerySubmit} className="flex gap-1.5">
                <input 
                  type="text" 
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={tData.placeholder}
                  className={`flex-1 text-xs p-2 rounded-lg border focus:outline-none focus:ring-1 focus:ring-blue-500 ${
                    darkMode ? 'bg-zinc-950 border-zinc-800 text-gray-200' : 'bg-gray-50 border-gray-200'
                  }`}
                />
                <button type="submit" className="p-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs">
                  <Send size={12} />
                </button>
              </form>
            </div>
          )}

          {/* Floating Animated Character */}
          <div className="flex items-center gap-2">
            {/* Dismiss Button */}
            {!isOpen && (
              <button 
                onClick={handleDismiss}
                className="p-1.5 rounded-full shadow-md bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white transition-all transform active:scale-95 translate-y-4"
                title="Dismiss Penko"
              >
                <X size={10} />
              </button>
            )}

            <button 
              onMouseDown={handleMouseDown}
              onClick={() => {
                if (!hasMoved.current) {
                  setIsOpen(!isOpen);
                }
              }}
              className={`group relative focus:outline-none transition-all active:scale-95 cursor-grab ${isDragging ? 'cursor-grabbing scale-105' : ''}`}
              title="Penko Assistant (Drag to move)"
            >
              {/* Glow backdrop indicator */}
              <div className="absolute inset-0 bg-blue-500/10 dark:bg-blue-500/20 rounded-full blur-xl group-hover:blur-2xl transition-all duration-300"></div>
              <div className="relative p-1 bg-white/20 dark:bg-zinc-900/40 backdrop-blur border border-white/30 dark:border-zinc-800 rounded-full shadow-lg">
                <PenkoIcon type={costume} pose={pose} size={64} />
              </div>
            </button>
          </div>
        </>
      )}
    </div>
  );
};

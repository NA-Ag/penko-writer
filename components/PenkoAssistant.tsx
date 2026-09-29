import React, { useState, useEffect, useRef, useCallback } from 'react';
import { PenkoIcon } from './PenkoIcon';
import { useApp } from '../AppContext';
import { X, Send, Bell } from 'lucide-react';

interface LocalizedAssistantData {
  summon: string;
  dismiss: string;
  dragToMove: string;
  /** {term} / {count} placeholders */
  found: string;
  assistant: string;
  youRang: string;
  placeholder: string;
  tips: string[];
  replies: Record<string, string>;
  unknown: string;
}

const LOCALIZED_ASSISTANT: Record<string, LocalizedAssistantData> = {
  'en-US': {
    dismiss: "Dismiss Penko",
    dragToMove: "Penko Assistant (Drag to move)",
    found: "Found \"{term}\" {count} times in the document.",
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
      stats: "Click the Stats button in the View tab to see word and character count!",
      ruler: "You can toggle the horizontal margin ruler from the checkbox inside the View tab!",
      markdown: "Enable Markdown Mode in the View tab to edit your document in raw Markdown with live preview side-by-side!",
      bibliography: "Go to the References tab, insert citation details, and choose your format style to output bibliography lists!",
      clippy: "I am Penko, your helpful writing assistant penguin! I was inspired by Clippy from old Microsoft Office."
    },
    unknown: "I'm still learning! Try asking me about 'save', 'export', 'stats', 'markdown', or 'bibliography'!"
  },
  'es': {
    dismiss: "Descartar a Penko",
    dragToMove: "Asistente Penko (arrastra para mover)",
    found: "Encontré \"{term}\" {count} veces en el documento.",
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
    dismiss: "Congédier Penko",
    dragToMove: "Assistant Penko (glisser pour déplacer)",
    found: "J'ai trouvé \"{term}\" {count} fois dans le document.",
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
    dismiss: "Penko ausblenden",
    dragToMove: "Penko-Assistent (zum Verschieben ziehen)",
    found: "Ich habe \"{term}\" {count} Mal im Dokument gefunden.",
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
    dismiss: "ペンコを隠す",
    dragToMove: "ペンコ アシスタント（ドラッグで移動）",
    found: "ドキュメント内で「{term}」が {count} 回見つかりました。",
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
      stats: "表示タブの「統計」から、文字数や単語数を確認できます。",
      ruler: "表示タブのチェックボックスから、ルーラー（定規）の表示/非表示を切り替えられます。",
      markdown: "表示タブでマークダウンモードを有効にすると、マークダウンで編集しながらプレビューを確認できます。",
      bibliography: "参照タブで文献情報を入力し、フォーマットを選択して文献目録を出力できます。",
      clippy: "私は執筆アシスタントペンギンのペンコです！昔のOfficeのクリッパー（Clippy）を参考にしています。"
    },
    unknown: "現在学習中です！「保存」、「エクスポート」、「統計」、「マークダウン」、「文献目録」などについて聞いてみてください。"
  },
  'zh': {
    dismiss: "隐藏 Penko",
    dragToMove: "Penko 助手（拖动以移动）",
    found: "在文档中找到了 {count} 次 \"{term}\"。",
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
    dismiss: "Сховати Пенко",
    dragToMove: "Помічник Пенко (перетягніть, щоб перемістити)",
    found: "Знайдено \"{term}\" у документі {count} разів.",
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
    dismiss: "Скрыть Пенко",
    dragToMove: "Помощник Пенко (перетащите, чтобы переместить)",
    found: "Найдено \"{term}\" в документе {count} раз.",
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
  },
  'pt': {
    dismiss: "Dispensar o Penko",
    dragToMove: "Assistente Penko (arraste para mover)",
    found: "Encontrei \"{term}\" {count} vezes no documento.",
    summon: "Chamar o Penko",
    assistant: "Assistente Penko",
    youRang: "Chamou?",
    placeholder: "Pergunte como salvar, exportar...",
    tips: [
      "Dica: Pressione Ctrl + S para salvar seu documento instantaneamente no armazenamento local!",
      "Dica: Ative o Modo Markdown na guia Exibir para editar em Markdown puro!",
      "Dica: Você pode arrastar e soltar títulos no painel Estrutura para reordenar seções.",
      "Dica: Use a ferramenta de Bibliografia na guia Referências para inserir citações nos estilos APA ou MLA.",
      "Dica: Copie a formatação de um texto e aplique-a em outro lugar com o Pincel de Formatação na guia Página Inicial!",
      "Dica: Insira equações usando LaTeX. Clique no botão Equação na guia Inserir para começar.",
      "Dica: Acesse o Modo Foco/Zen pela guia Exibir para escrever sem distrações."
    ],
    replies: {
      save: "Pressione Ctrl + S ou clique no botão Salvar na barra lateral esquerda para salvar seu documento no armazenamento local!",
      export: "Você pode exportar seu documento como DOCX, PDF, HTML ou TXT. Clique no menu Exportar na barra lateral esquerda.",
      stats: "Clique no botão Estatísticas na guia Exibir para ver a contagem de palavras e caracteres!",
      ruler: "Você pode ativar ou desativar a régua de margens horizontal pela caixa de seleção na guia Exibir!",
      markdown: "Ative o Modo Markdown na guia Exibir para editar seu documento em Markdown puro com visualização ao vivo lado a lado!",
      bibliography: "Vá até a guia Referências, insira os dados da citação e escolha o estilo de formatação para gerar listas de bibliografia!",
      clippy: "Eu sou o Penko, seu pinguim assistente de escrita! Fui inspirado no Clippy do antigo Microsoft Office."
    },
    unknown: "Ainda estou aprendendo! Tente me perguntar sobre 'salvar', 'exportar', 'estatísticas', 'régua', 'markdown' ou 'bibliografia'!"
  },
  'it': {
    dismiss: "Congeda Penko",
    dragToMove: "Assistente Penko (trascina per spostare)",
    found: "Ho trovato \"{term}\" {count} volte nel documento.",
    summon: "Chiama Penko",
    assistant: "Assistente Penko",
    youRang: "Mi hai chiamato?",
    placeholder: "Chiedimi come salvare, esportare...",
    tips: [
      "Suggerimento: premi Ctrl + S per salvare subito il documento nell'archivio locale!",
      "Suggerimento: attiva la modalità Markdown nella scheda Visualizza per modificare in Markdown puro!",
      "Suggerimento: puoi trascinare i titoli nel pannello Struttura per riordinare le sezioni.",
      "Suggerimento: usa lo strumento Bibliografia nella scheda Riferimenti per inserire citazioni in stile APA o MLA.",
      "Suggerimento: copia la formattazione di un testo e applicala altrove con lo strumento Copia formato nella scheda Home!",
      "Suggerimento: inserisci equazioni con LaTeX. Fai clic sul pulsante Formula nella scheda Inserisci per iniziare.",
      "Suggerimento: apri la modalità Focus/Zen dalla scheda Visualizza per scrivere senza distrazioni."
    ],
    replies: {
      save: "Premi Ctrl + S oppure fai clic sul pulsante Salva nella barra laterale sinistra per salvare il documento nell'archivio locale!",
      export: "Puoi esportare il documento in DOCX, PDF, HTML o TXT. Fai clic sul menu Esporta nella barra laterale sinistra.",
      stats: "Fai clic sul pulsante Statistiche nella scheda Visualizza per vedere il conteggio di parole e caratteri!",
      ruler: "Puoi mostrare o nascondere il righello orizzontale dei margini con la casella di controllo nella scheda Visualizza!",
      markdown: "Attiva la modalità Markdown nella scheda Visualizza per modificare il documento in Markdown puro con l'anteprima live affiancata!",
      bibliography: "Vai alla scheda Riferimenti, inserisci i dati della citazione e scegli lo stile per generare la bibliografia!",
      clippy: "Sono Penko, il pinguino che ti aiuta a scrivere! Mi sono ispirato a Clippy del vecchio Microsoft Office."
    },
    unknown: "Sto ancora imparando! Prova a chiedermi di 'salvare', 'esportare', 'statistiche', 'markdown' o 'bibliografia'!"
  },
  'ko': {
    dismiss: "Penko 닫기",
    dragToMove: "Penko 도우미(드래그하여 이동)",
    found: "문서에서 \"{term}\"을(를) {count}번 찾았습니다.",
    summon: "Penko 부르기",
    assistant: "Penko 도우미",
    youRang: "부르셨나요?",
    placeholder: "저장, 내보내기 방법 등을 물어보세요...",
    tips: [
      "팁: Ctrl + S를 누르면 문서가 로컬 저장소에 바로 저장됩니다!",
      "팁: 보기 탭에서 Markdown 모드를 켜면 Markdown 원본으로 편집할 수 있습니다!",
      "팁: 개요 패널에서 제목을 끌어다 놓아 섹션 순서를 바꿀 수 있습니다.",
      "팁: 참조 탭의 참고 문헌 도구로 APA 또는 MLA 스타일 인용을 삽입하세요.",
      "팁: 홈 탭의 서식 복사 도구로 텍스트의 서식을 복사해 다른 곳에 적용하세요!",
      "팁: LaTeX로 수식을 삽입하세요. 삽입 탭의 수식 버튼을 클릭하여 시작하세요.",
      "팁: 보기 탭에서 집중/젠 모드를 열어 방해 없이 글을 써 보세요."
    ],
    replies: {
      save: "Ctrl + S를 누르거나 왼쪽 사이드바의 저장 버튼을 클릭하면 문서가 로컬 저장소에 저장됩니다!",
      export: "문서를 DOCX, PDF, HTML, TXT로 내보낼 수 있습니다. 왼쪽 사이드바의 내보내기 메뉴를 클릭하세요.",
      stats: "보기 탭의 통계 버튼을 클릭하면 단어 수와 문자 수를 볼 수 있습니다!",
      ruler: "보기 탭의 확인란으로 가로 여백 눈금자를 켜거나 끌 수 있습니다!",
      markdown: "보기 탭에서 Markdown 모드를 켜면 실시간 미리 보기를 옆에 두고 Markdown 원본으로 편집할 수 있습니다!",
      bibliography: "참조 탭에서 인용 정보를 입력하고 서식 스타일을 선택하면 참고 문헌 목록을 만들 수 있습니다!",
      clippy: "저는 여러분의 글쓰기를 돕는 펭귄 도우미 Penko입니다! 예전 Microsoft Office의 Clippy에게서 영감을 받았어요."
    },
    unknown: "아직 배우는 중이에요! '저장', '내보내기', '통계', 'markdown', '참고 문헌'에 대해 물어보세요!"
  },
  'ar': {
    dismiss: "إخفاء Penko",
    dragToMove: "مساعد Penko (اسحب للتحريك)",
    found: "عثرت على \"{term}\" {count} مرة في المستند.",
    summon: "استدعاء Penko",
    assistant: "مساعد Penko",
    youRang: "هل ناديتني؟",
    placeholder: "اسألني كيف أحفظ، أصدّر...",
    tips: [
      "تلميح: اضغط Ctrl + S لحفظ مستندك فورًا في التخزين المحلي!",
      "تلميح: فعّل وضع Markdown من علامة التبويب «عرض» للتحرير بـ Markdown الخام!",
      "تلميح: يمكنك سحب العناوين وإفلاتها في لوحة المخطط لإعادة ترتيب الأقسام.",
      "تلميح: استخدم أداة قائمة المراجع في علامة التبويب «مراجع» لإدراج اقتباسات بنمط APA أو MLA.",
      "تلميح: انسخ تنسيق نص وطبّقه في مكان آخر باستخدام أداة «نسخ التنسيق» في علامة التبويب «الصفحة الرئيسية»!",
      "تلميح: أدرج المعادلات باستخدام LaTeX. انقر على زر المعادلة في علامة التبويب «إدراج» للبدء.",
      "تلميح: ادخل إلى وضع التركيز (Zen) من علامة التبويب «عرض» للكتابة دون مشتتات."
    ],
    replies: {
      save: "اضغط Ctrl + S، أو انقر على زر «حفظ» في الشريط الجانبي الأيسر لحفظ مستندك في التخزين المحلي!",
      export: "يمكنك تصدير مستندك بتنسيق DOCX أو PDF أو HTML أو TXT. انقر على القائمة المنسدلة «تصدير» في الشريط الجانبي الأيسر.",
      stats: "انقر على زر «إحصائيات» في علامة التبويب «عرض» لمعرفة عدد الكلمات والأحرف!",
      ruler: "يمكنك إظهار مسطرة الهوامش الأفقية أو إخفاؤها من خانة الاختيار في علامة التبويب «عرض»!",
      markdown: "فعّل وضع Markdown من علامة التبويب «عرض» لتحرير مستندك بـ Markdown الخام مع معاينة مباشرة جنبًا إلى جنب!",
      bibliography: "انتقل إلى علامة التبويب «مراجع»، وأدخل تفاصيل الاقتباس، واختر نمط التنسيق لإنشاء قوائم المراجع!",
      clippy: "أنا Penko، البطريق المساعد في الكتابة! استُلهمت من Clippy في إصدارات Microsoft Office القديمة."
    },
    unknown: "ما زلت أتعلّم! جرّب أن تسألني عن «حفظ» أو «تصدير» أو «إحصائيات» أو «markdown» أو «مراجع»!"
  },
  'hi': {
    dismiss: "Penko को हटाएँ",
    dragToMove: "Penko सहायक (खिसकाने के लिए खींचें)",
    found: "दस्तावेज़ में \"{term}\" {count} बार मिला।",
    summon: "Penko को बुलाएँ",
    assistant: "Penko सहायक",
    youRang: "आपने बुलाया?",
    placeholder: "मुझसे पूछें कि कैसे सहेजें, निर्यात करें...",
    tips: [
      "सुझाव: अपना दस्तावेज़ तुरंत स्थानीय संग्रहण में सहेजने के लिए Ctrl + S दबाएँ!",
      "सुझाव: कच्चे Markdown में संपादन के लिए दृश्य टैब में Markdown मोड चालू करें!",
      "सुझाव: अनुभागों का क्रम बदलने के लिए आप रूपरेखा पैनल में शीर्षकों को खींचकर छोड़ सकते हैं।",
      "सुझाव: APA या MLA शैली में उद्धरण सम्मिलित करने के लिए संदर्भ टैब में ग्रंथसूची उपकरण का उपयोग करें।",
      "सुझाव: होम टैब के फ़ॉर्मेट पेंटर से किसी टेक्स्ट की फ़ॉर्मेटिंग कॉपी करके कहीं और लागू करें!",
      "सुझाव: LaTeX से समीकरण सम्मिलित करें। शुरू करने के लिए सम्मिलित करें टैब में सूत्र बटन पर क्लिक करें।",
      "सुझाव: बिना ध्यान भटकाए लिखने के लिए दृश्य टैब से फ़ोकस/ज़ेन मोड खोलें।"
    ],
    replies: {
      save: "अपना दस्तावेज़ स्थानीय संग्रहण में सहेजने के लिए Ctrl + S दबाएँ, या बाएँ साइडबार में सहेजें बटन पर क्लिक करें!",
      export: "आप अपना दस्तावेज़ DOCX, PDF, HTML या TXT के रूप में निर्यात कर सकते हैं। बाएँ साइडबार में निर्यात ड्रॉपडाउन पर क्लिक करें।",
      stats: "शब्द और वर्ण संख्या देखने के लिए दृश्य टैब में आँकड़े बटन पर क्लिक करें!",
      ruler: "आप दृश्य टैब के चेकबॉक्स से क्षैतिज हाशिया रूलर चालू या बंद कर सकते हैं!",
      markdown: "अपने दस्तावेज़ को कच्चे Markdown में साथ-साथ लाइव पूर्वावलोकन के साथ संपादित करने के लिए दृश्य टैब में Markdown मोड चालू करें!",
      bibliography: "संदर्भ टैब पर जाएँ, उद्धरण का विवरण डालें और ग्रंथसूची बनाने के लिए अपनी फ़ॉर्मेट शैली चुनें!",
      clippy: "मैं Penko हूँ, आपका मददगार लेखन सहायक पेंगुइन! मुझे पुराने Microsoft Office के Clippy से प्रेरणा मिली है।"
    },
    unknown: "मैं अभी सीख रहा हूँ! मुझसे 'सहेजें', 'निर्यात', 'आँकड़े', 'markdown' या 'ग्रंथसूची' के बारे में पूछकर देखें!"
  }
};

const DISMISS_KEY = 'penko_writer_assistant_dismissed';
const WORD_MILESTONE = 100;

const readDismissed = () => {
  try { return localStorage.getItem(DISMISS_KEY) === '1'; } catch { return false; }
};
const writeDismissed = (value: boolean) => {
  try {
    if (value) localStorage.setItem(DISMISS_KEY, '1');
    else localStorage.removeItem(DISMISS_KEY);
  } catch { /* storage unavailable */ }
};
const prefersReducedMotion = () =>
  typeof window !== 'undefined' && !!window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Returns the canned reply for a query (pure; exported for tests). */
export const getAssistantReply = (query: string, lang: string, getText: () => string): string => {
  const tData = LOCALIZED_ASSISTANT[lang] || LOCALIZED_ASSISTANT['en-US'];
  const q = query.toLowerCase();
  const searchMatch = query.match(/^(find|search|buscar|suche|chercher|поиск|пошук|検索|查找|procurar|localizar|cerca|trova|찾기|검색|ابحث|بحث|جد|खोजें|ढूँढें|खोज)\s+(.+)$/i);
  if (searchMatch) {
    const term = searchMatch[2].trim();
    let count = 0;
    if (term) {
      const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      count = (getText().match(new RegExp(escaped, 'gi')) || []).length;
    }
    return tData.found.replace('{term}', term).replace('{count}', String(count));
  }
  const has = (...words: string[]) => words.some(w => q.includes(w));
  if (has('save', 'guardar', 'sauvegarder', 'speichern', '保存', 'зберегти', 'сохранить', 'salvar', 'salva', 'salvare', '저장', 'حفظ', 'احفظ', 'सहेज', 'सेव')) return tData.replies.save;
  if (has('export', 'download', 'descargar', 'télécharger', 'herunterladen', 'エクスポート', '导出', 'експорт', 'экспорт', 'exportar', 'baixar', 'esporta', 'scarica', '내보내기', '다운로드', 'تصدير', 'صدّر', 'تنزيل', 'निर्यात', 'एक्सपोर्ट', 'डाउनलोड')) return tData.replies.export;
  if (has('stats', 'words', 'count', 'estadísticas', 'statistiques', 'wörter', '文字数', '字数', 'статистика', 'estatísticas', 'palavras', 'contagem', 'statistiche', 'parole', 'conteggio', '통계', '단어 수', '글자 수', 'إحصائيات', 'كلمات', 'عدد', 'आँकड़े', 'शब्द', 'गिनती')) return tData.replies.stats;
  if (has('ruler', 'regla', 'règle', 'lineal', 'ルーラー', '标尺', 'лінійка', 'линейка', 'régua', 'righello', '눈금자', 'مسطرة', 'المسطرة', 'रूलर', 'पैमाना')) return tData.replies.ruler;
  if (has('markdown', 'マークダウン')) return tData.replies.markdown;
  if (has('bibliography', 'citation', 'bibliografía', 'bibliographie', 'literaturverzeichnis', '文献目録', '文献目录', 'бібліографія', 'библиография', 'bibliografia', 'citação', 'referências', 'citazione', 'citazioni', '참고 문헌', '참고문헌', '인용', 'مراجع', 'اقتباس', 'ببليوغرافيا', 'ग्रंथसूची', 'उद्धरण')) return tData.replies.bibliography;
  if (has('clippy', 'who are you', 'quién eres', 'qui es-tu', 'wer bist du', 'あなたは誰', '你是谁', 'хто ти', 'кто ты', 'quem é você', 'quem é o penko', 'chi sei', '누구', '클리피', 'من أنت', 'كليبي', 'कौन हो', 'कौन हैं')) return tData.replies.clippy;
  return tData.unknown;
};

type Pose = 'idle' | 'talk' | 'hurt' | 'jump' | 'walk';

interface AssistantViewProps {
  darkMode: boolean;
  lang: string;
  docId: string | undefined;
  milestone: number;
  getText: () => string;
}

/**
 * Only re-renders when its (primitive) props change — the word-count
 * milestone rather than every document edit.
 */
const AssistantView: React.FC<AssistantViewProps> = React.memo(({ darkMode, lang, docId, milestone, getText }) => {
  const tData = LOCALIZED_ASSISTANT[lang] || LOCALIZED_ASSISTANT['en-US'];

  const [isOpen, setIsOpen] = useState(false);
  const [isDismissed, setIsDismissed] = useState(readDismissed);
  const [pose, setPose] = useState<Pose>('idle');
  const [costume, setCostume] = useState<'custom' | 'lurch'>('custom');
  const [message, setMessage] = useState(() => tData.tips[0]);
  const [query, setQuery] = useState('');

  // --- timers (all tracked, cleared on unmount) ---
  const timers = useRef(new Set<number>());
  const later = useCallback((fn: () => void, ms: number) => {
    const id = window.setTimeout(() => {
      timers.current.delete(id);
      fn();
    }, ms);
    timers.current.add(id);
    return id;
  }, []);
  const clearTimers = useCallback(() => {
    timers.current.forEach(id => window.clearTimeout(id));
    timers.current.clear();
  }, []);
  useEffect(() => clearTimers, [clearTimers]);

  const flash = useCallback((p: Pose, ms: number) => {
    clearTimers();
    setPose(p);
    later(() => setPose('idle'), ms);
  }, [clearTimers, later]);

  // Synchronize tips list based on active language
  useEffect(() => {
    setMessage(tData.tips[0]);
  }, [tData]);

  // Talk briefly when the bubble opens
  useEffect(() => {
    if (isOpen && costume !== 'lurch') flash('talk', 2000);
  }, [isOpen]);

  // Periodic cute random movement (paused while hidden / reduced motion)
  useEffect(() => {
    if (isOpen || isDismissed || prefersReducedMotion()) return;
    const interval = window.setInterval(() => {
      if (document.visibilityState === 'hidden') return;
      const rand = Math.random();
      if (rand < 0.3) flash('jump', 1200);
      else if (rand < 0.6) flash('walk', 1500);
    }, 20000);
    return () => window.clearInterval(interval);
  }, [isOpen, isDismissed, flash]);

  // Celebrate word-count milestones (not every keystroke, not on doc switch)
  const lastMilestone = useRef({ docId, milestone });
  useEffect(() => {
    const prev = lastMilestone.current;
    lastMilestone.current = { docId, milestone };
    if (prev.docId !== docId || milestone <= prev.milestone) return;
    if (isDismissed || costume === 'lurch' || prefersReducedMotion()) return;
    flash('jump', 1000);
  }, [docId, milestone]);

  // --- dragging (pointer events: mouse + touch + pen), clamped to the viewport ---
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ id: number; sx: number; sy: number; px: number; py: number; minX: number; maxX: number; minY: number; maxY: number } | null>(null);
  const hasMoved = useRef(false);

  const handlePointerDown = (e: React.PointerEvent<HTMLElement>) => {
    if (e.button !== 0 || !rootRef.current) return;
    const rect = rootRef.current.getBoundingClientRect();
    drag.current = {
      id: e.pointerId,
      sx: e.clientX,
      sy: e.clientY,
      px: position.x,
      py: position.y,
      minX: position.x - rect.left,
      maxX: position.x + (window.innerWidth - rect.right),
      minY: position.y - rect.top,
      maxY: position.y + (window.innerHeight - rect.bottom),
    };
    hasMoved.current = false;
    try {
      e.currentTarget.setPointerCapture?.(e.pointerId);
    } catch {
      /* pointer already released */
    }
  };
  const handlePointerMove = (e: React.PointerEvent<HTMLElement>) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    const dx = e.clientX - d.sx;
    const dy = e.clientY - d.sy;
    if (!hasMoved.current && Math.abs(dx) + Math.abs(dy) < 5) return;
    if (!hasMoved.current) {
      hasMoved.current = true;
      setIsDragging(true);
    }
    const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), Math.max(lo, hi));
    setPosition({ x: clamp(d.px + dx, d.minX, d.maxX), y: clamp(d.py + dy, d.minY, d.maxY) });
  };
  const handlePointerUp = (e: React.PointerEvent<HTMLElement>) => {
    if (drag.current?.id !== e.pointerId) return;
    drag.current = null;
    setIsDragging(false);
  };
  /** True (once) when the click that follows a pointer-up ended a drag. */
  const consumeDrag = () => {
    const moved = hasMoved.current;
    hasMoved.current = false;
    return moved;
  };
  const dragHandlers = {
    onPointerDown: handlePointerDown,
    onPointerMove: handlePointerMove,
    onPointerUp: handlePointerUp,
    onPointerCancel: handlePointerUp,
  };

  // Keep Penko on screen when the window shrinks (rotation, keyboard…)
  useEffect(() => {
    const onResize = () => {
      const el = rootRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      setPosition(p => {
        let { x, y } = p;
        if (r.right > window.innerWidth) x -= r.right - window.innerWidth;
        if (r.left < 0) x -= r.left;
        if (r.bottom > window.innerHeight) y -= r.bottom - window.innerHeight;
        if (r.top < 0) y -= r.top;
        return x === p.x && y === p.y ? p : { x, y };
      });
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const handleQuerySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    clearTimers(); // a pending summon transition must not overwrite this reply
    setCostume('custom');
    setMessage(getAssistantReply(query, lang, getText));
    setQuery('');
    flash('talk', 2000);
  };

  // The summon pill is replaced by Penko: move focus along instead of losing it
  const penkoButtonRef = useRef<HTMLButtonElement>(null);
  const focusPenko = useRef(false);
  useEffect(() => {
    if (isDismissed || !focusPenko.current) return;
    focusPenko.current = false;
    penkoButtonRef.current?.focus();
  }, [isDismissed]);

  const handleSummon = () => {
    focusPenko.current = document.activeElement?.closest('button') != null;
    clearTimers();
    setIsDismissed(false);
    writeDismissed(false);
    setCostume('lurch');
    setPose('talk');
    setMessage(tData.youRang);
    setIsOpen(true);

    // After 2.5s, transition back to the standard wizard costume with a tip
    later(() => {
      setCostume('custom');
      setPose('idle');
      setMessage(tData.tips[Math.floor(Math.random() * tData.tips.length)]);
    }, 2500);
  };

  const handleDismiss = (e: React.MouseEvent) => {
    e.stopPropagation();
    clearTimers();
    setPose('idle');
    setIsOpen(false);
    setIsDismissed(true);
    writeDismissed(true);
  };

  const bg = darkMode
    ? 'bg-zinc-900/95 border-zinc-800 text-gray-200'
    : 'bg-white/95 border-gray-200 text-gray-800';

  return (
    <div
      ref={rootRef}
      className="fixed bottom-20 right-8 z-50 flex flex-col items-end print:hidden select-none"
      style={{ transform: `translate(${position.x}px, ${position.y}px)` }}
      // Escape closes the bubble while focus is on Penko or inside the bubble
      onKeyDown={e => {
        if (e.key === 'Escape' && isOpen) setIsOpen(false);
      }}
    >
      {isDismissed ? (
        <button
          {...dragHandlers}
          onClick={() => {
            if (!consumeDrag()) handleSummon();
          }}
          className={`flex items-center gap-2 px-3 py-2 rounded-full shadow-lg border text-xs font-semibold backdrop-blur bg-blue-600 hover:bg-blue-500 text-white transition-all transform active:scale-95 cursor-grab touch-none ${isDragging ? 'cursor-grabbing scale-105' : ''}`}
        >
          <Bell size={14} className="animate-bounce motion-reduce:animate-none" />
          <span>{tData.summon}</span>
        </button>
      ) : (
        <>
          {/* Speech Bubble */}
          {isOpen && (
            <div className={`mb-3 w-80 max-w-[calc(100vw-2rem)] rounded-2xl border p-4 shadow-2xl backdrop-blur-md transition-all duration-300 animate-fade-in ${bg}`}>
              {/* Header */}
              <div className="flex items-center justify-between mb-2 pb-1.5 border-b border-gray-100 dark:border-zinc-800">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-xs uppercase tracking-wider text-blue-500">{tData.assistant}</span>
                </div>
                <button onClick={() => setIsOpen(false)} className="opacity-50 hover:opacity-100" aria-label={tData.dismiss}><X size={14} /></button>
              </div>

              {/* Assistant Message Bubble */}
              <div className="text-sm leading-relaxed mb-4 min-h-[50px] flex items-center italic" aria-live="polite">
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
                title={tData.dismiss}
                aria-label={tData.dismiss}
              >
                <X size={10} />
              </button>
            )}

            <button
              ref={penkoButtonRef}
              {...dragHandlers}
              onClick={() => {
                if (!consumeDrag()) setIsOpen(!isOpen);
              }}
              className={`group relative focus:outline-none transition-all active:scale-95 cursor-grab touch-none ${isDragging ? 'cursor-grabbing scale-105' : ''}`}
              title={tData.dragToMove}
              aria-label={tData.assistant}
              aria-expanded={isOpen}
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
});

AssistantView.displayName = 'AssistantView';

export const PenkoAssistant: React.FC = () => {
  const { darkMode, uiLanguage, currentDoc, stats } = useApp();
  const lang = uiLanguage in LOCALIZED_ASSISTANT ? uiLanguage : 'en-US';

  // The document text is only needed on demand ("find …") and is computed
  // lazily, so keep the stats object in a ref and read `.text` in the getter.
  const statsRef = useRef(stats);
  statsRef.current = stats;
  const getText = useCallback(() => statsRef.current.text || '', []);

  return (
    <AssistantView
      darkMode={darkMode}
      lang={lang}
      docId={currentDoc?.id}
      milestone={Math.floor((stats.words || 0) / WORD_MILESTONE)}
      getText={getText}
    />
  );
};

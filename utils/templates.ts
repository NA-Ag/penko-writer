
import { Template } from "../types";

export const TEMPLATES: Template[] = [
  {
    id: 'blank',
    name: 'Blank Document',
    nameKey: 'templateBlankDocument',
    category: 'General',
    categoryKey: 'templateCategoryGeneral',
    thumbnail: 'bg-white border border-gray-200',
    content: '<p></p>'
  },
  {
    id: 'resume-creative',
    name: 'Creative Resume',
    nameKey: 'templateCreativeResume',
    category: 'CV',
    categoryKey: 'templateCategoryCV',
    thumbnail: 'bg-gradient-to-br from-slate-700 to-slate-800 border-none ring-2 ring-slate-200',
    pageConfig: {
      size: 'A4',
      orientation: 'portrait',
      margins: 'none' // Full bleed
    },
    content: `
      <table style="width: 100%; height: 297mm; border-collapse: collapse;">
        <tr>
          <!-- SIDEBAR -->
          <td style="width: 32%; background-color: #2e3b55; vertical-align: top; padding: 0;">
            <div style="padding: 40px 25px; color: white; height: 100%; box-sizing: border-box;">
              
              <!-- PHOTO PLACEHOLDER -->
              <div style="width: 120px; height: 120px; background-color: rgba(255,255,255,0.1); border-radius: 50%; margin: 0 auto 30px auto; display: flex; align-items: center; justify-content: center; border: 2px solid rgba(255,255,255,0.3);">
                <span style="font-size: 10px; letter-spacing: 1px; opacity: 0.7;">PHOTO</span>
              </div>

              <!-- CONTACT -->
              <h3 style="border-bottom: 1px solid rgba(255,255,255,0.2); padding-bottom: 10px; font-size: 14px; letter-spacing: 2px; margin-bottom: 20px; color: #a5b4fc;">CONTACT</h3>
              <div style="font-size: 12px; margin-bottom: 30px; line-height: 2.0; opacity: 0.9;">
                <div>📍 123 Street, City</div>
                <div>📞 (555) 123-4567</div>
                <div>✉️ mail@example.com</div>
                <div>🌐 www.portfolio.com</div>
              </div>

              <!-- SKILLS -->
              <h3 style="border-bottom: 1px solid rgba(255,255,255,0.2); padding-bottom: 10px; font-size: 14px; letter-spacing: 2px; margin-bottom: 20px; color: #a5b4fc;">SKILLS</h3>
              <div style="font-size: 12px; margin-bottom: 30px; line-height: 1.8;">
                <div style="margin-bottom: 5px;">• Strategic Planning</div>
                <div style="margin-bottom: 5px;">• Project Management</div>
                <div style="margin-bottom: 5px;">• Data Analysis</div>
                <div style="margin-bottom: 5px;">• Public Speaking</div>
                <div style="margin-bottom: 5px;">• Creative Writing</div>
              </div>

              <!-- AWARDS -->
              <h3 style="border-bottom: 1px solid rgba(255,255,255,0.2); padding-bottom: 10px; font-size: 14px; letter-spacing: 2px; margin-bottom: 20px; color: #a5b4fc;">AWARDS</h3>
              <div style="font-size: 12px; line-height: 1.6;">
                <div style="font-weight: bold; color: white;">Best Innovator</div>
                <div style="opacity: 0.7; margin-bottom: 10px;">Tech Conf 2023</div>
                
                <div style="font-weight: bold; color: white;">Employee of Month</div>
                <div style="opacity: 0.7;">June 2022</div>
              </div>

            </div>
          </td>

          <!-- MAIN CONTENT -->
          <td style="vertical-align: top; padding: 0;">
            <div style="padding: 50px 40px; height: 100%; box-sizing: border-box; background-color: white;">
              
              <h1 style="color: #2e3b55; margin: 0; font-size: 42px; line-height: 1; letter-spacing: -1px; font-family: 'Arial', sans-serif;">ALEX<br>JORDAN</h1>
              <p style="color: #666; font-size: 14px; letter-spacing: 4px; margin-top: 10px; text-transform: uppercase; font-weight: bold;">Marketing Specialist</p>
              
              <hr style="border: 0; border-top: 4px solid #2e3b55; margin: 30px 0; width: 50px;">
              
              <h3 style="color: #2e3b55; font-size: 16px; letter-spacing: 1px; margin-bottom: 15px;">PROFILE</h3>
              <p style="font-size: 13px; line-height: 1.6; color: #444; margin-bottom: 40px;">
                Innovative marketing professional with over 5 years of experience driving brand growth and engagement. Expert in digital strategy and content creation. Proven track record of increasing ROI through targeted campaigns and data-driven decision making.
              </p>
              
              <h3 style="color: #2e3b55; font-size: 16px; letter-spacing: 1px; margin-bottom: 20px;">WORK EXPERIENCE</h3>
              
              <div style="margin-bottom: 25px;">
                  <div style="display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 5px;">
                     <span style="font-weight: bold; font-size: 15px; color: #000;">Senior Marketer</span>
                     <span style="font-size: 12px; font-weight: bold; color: #2e3b55;">2020 - Present</span>
                  </div>
                  <div style="color: #666; font-size: 13px; margin-bottom: 8px; font-style: italic;">Creative Solutions Inc.</div>
                  <ul style="font-size: 13px; margin: 0; padding-left: 20px; color: #444; line-height: 1.5;">
                    <li>Led a cross-functional team of 5 designers and copywriters.</li>
                    <li>Increased social media engagement by 40% YOY.</li>
                    <li>Managed a budget of $50k/quarter with 98% efficiency.</li>
                  </ul>
              </div>
              
              <div style="margin-bottom: 25px;">
                  <div style="display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 5px;">
                     <span style="font-weight: bold; font-size: 15px; color: #000;">Marketing Associate</span>
                     <span style="font-size: 12px; font-weight: bold; color: #2e3b55;">2017 - 2019</span>
                  </div>
                  <div style="color: #666; font-size: 13px; margin-bottom: 8px; font-style: italic;">StartUp World</div>
                  <ul style="font-size: 13px; margin: 0; padding-left: 20px; color: #444; line-height: 1.5;">
                    <li>Managed email campaigns for 10k+ subscribers.</li>
                    <li>Coordinated 12 successful product launch events.</li>
                  </ul>
              </div>
              
              <h3 style="color: #2e3b55; font-size: 16px; letter-spacing: 1px; margin-bottom: 20px; margin-top: 40px;">EDUCATION</h3>
              
              <div style="margin-bottom: 15px;">
                 <div style="font-weight: bold; font-size: 14px; color: #000;">Bachelor of Science in Marketing</div>
                 <div style="color: #444; font-size: 13px;">State University, New York</div>
                 <div style="color: #888; font-size: 12px; margin-top: 2px;">Graduated with Honors • 2013 - 2017</div>
              </div>

            </div>
          </td>
        </tr>
      </table>
    `
  },
  {
    id: 'resume-modern',
    name: 'Clean Resume',
    nameKey: 'templateCleanResume',
    category: 'CV',
    categoryKey: 'templateCategoryCV',
    thumbnail: 'bg-white border border-gray-300',
    content: `
      <div style="font-family: 'Arial', sans-serif; color: #333;">
        <h1 style="text-align: center; text-transform: uppercase; letter-spacing: 4px; font-weight: normal; margin-bottom: 10px;">Jordan Smith</h1>
        <p style="text-align: center; color: #666; font-size: 10pt;">123 Business Rd, Tech City • (555) 010-9999 • jordan.smith@email.com</p>
        <hr style="border: 0; border-top: 1px solid #ccc; margin: 20px 0;">
        
        <h3 style="color: #000; border-bottom: 1px solid #000; padding-bottom: 3px; text-transform: uppercase; font-size: 10pt; margin-top: 20px; letter-spacing: 1px;">Summary</h3>
        <p style="font-size: 11pt;">Detail-oriented professional with strong organizational skills and a track record of success in project management. Proven ability to streamline operations and increase team efficiency.</p>
        
        <h3 style="color: #000; border-bottom: 1px solid #000; padding-bottom: 3px; text-transform: uppercase; font-size: 10pt; margin-top: 25px; letter-spacing: 1px;">Experience</h3>
        
        <div style="margin-bottom: 20px;">
          <table style="width: 100%; border-collapse: collapse;">
              <tr>
                  <td style="font-weight: bold; font-size: 11pt;">Project Manager</td>
                  <td style="text-align: right; font-size: 11pt;">San Francisco, CA</td>
              </tr>
              <tr>
                  <td style="color: #555; font-style: italic; font-size: 10pt;">TechCorp Industries</td>
                  <td style="text-align: right; color: #555; font-style: italic; font-size: 10pt;">2019 – Present</td>
              </tr>
          </table>
          <ul style="margin-top: 5px; font-size: 11pt; padding-left: 20px;">
            <li>Spearheaded the deployment of new CRM software across 3 departments.</li>
            <li>Reduced operational costs by 15% through workflow optimization.</li>
            <li>Mentored junior staff members.</li>
          </ul>
        </div>

        <div style="margin-bottom: 20px;">
          <table style="width: 100%; border-collapse: collapse;">
              <tr>
                  <td style="font-weight: bold; font-size: 11pt;">Analyst</td>
                  <td style="text-align: right; font-size: 11pt;">New York, NY</td>
              </tr>
              <tr>
                  <td style="color: #555; font-style: italic; font-size: 10pt;">DataFlow Systems</td>
                  <td style="text-align: right; color: #555; font-style: italic; font-size: 10pt;">2016 – 2019</td>
              </tr>
          </table>
          <ul style="margin-top: 5px; font-size: 11pt; padding-left: 20px;">
            <li>Analyzed market trends to inform strategy.</li>
            <li>Prepared weekly reports for executive leadership.</li>
          </ul>
        </div>

        <h3 style="color: #000; border-bottom: 1px solid #000; padding-bottom: 3px; text-transform: uppercase; font-size: 10pt; margin-top: 25px; letter-spacing: 1px;">Education</h3>
        <table style="width: 100%; border-collapse: collapse;">
            <tr>
                <td style="font-weight: bold; font-size: 11pt;">Bachelor of Science in Business</td>
                <td style="text-align: right; font-size: 11pt;">2016</td>
            </tr>
            <tr>
                <td style="color: #555; font-size: 10pt;">University of Excellence</td>
                <td style="text-align: right;"></td>
            </tr>
        </table>
      </div>
    `
  },
  {
    id: 'cover-letter',
    name: 'Cover Letter',
    nameKey: 'templateCoverLetter',
    category: 'Letters',
    categoryKey: 'templateCategoryLetters',
    thumbnail: 'bg-gray-50 border border-gray-200',
    content: `
      <div style="font-family: 'Times New Roman', serif; line-height: 1.6; font-size: 12pt; color: #000;">
        <p style="text-align: right;">October 24, 2025</p>
        
        <p style="margin-bottom: 30px;">
          <strong>Hiring Manager</strong><br>
          Global Corp Inc.<br>
          456 Corporate Blvd<br>
          Metropolis, NY 10012
        </p>
        
        <p>Dear Hiring Manager,</p>
        
        <p>I am writing to express my enthusiastic interest in the <strong>Senior Project Coordinator</strong> position at Global Corp Inc., as advertised on LinkedIn. With over seven years of experience in facilitating complex projects and a passion for operational efficiency, I am eager to contribute to your team's continued success.</p>
        
        <p>In my previous role at TechFlow Solutions, I managed a portfolio of 15+ concurrent projects, ensuring on-time delivery while reducing budget overruns by 20%. My ability to bridge the gap between technical teams and stakeholders has been a key driver in my career.</p>
        
        <p>I admire Global Corp’s commitment to sustainability and innovation, and I am excited about the possibility of bringing my skills in agile methodologies and team leadership to your dynamic environment.</p>
        
        <p>Thank you for considering my application. I look forward to the opportunity to discuss how my background, skills, and certifications can benefit your organization.</p>
        
        <p style="margin-top: 30px;">Sincerely,</p>
        <br>
        <p><strong>Jordan Smith</strong></p>
      </div>
    `
  },
  {
    id: 'project-proposal',
    name: 'Project Proposal',
    nameKey: 'templateProjectProposal',
    category: 'Business',
    categoryKey: 'templateCategoryBusiness',
    thumbnail: 'bg-blue-50 border border-blue-100',
    content: `
      <div style="font-family: 'Calibri', 'Arial', sans-serif; color: #333;">
        <h1 style="color: #1e3a8a; font-size: 28pt; margin-bottom: 5px;">Project Proposal</h1>
        <h2 style="color: #64748b; font-size: 16pt; margin-top: 0; font-weight: normal;">Website Redesign Initiative</h2>
        <hr style="border: 2px solid #1e3a8a; margin: 20px 0;">
        
        <div style="background-color: #f1f5f9; padding: 20px; border-left: 5px solid #1e3a8a; margin-bottom: 30px;">
            <strong style="color: #1e3a8a; text-transform: uppercase; font-size: 10pt; letter-spacing: 1px;">Executive Summary</strong>
            <p style="margin-top: 10px; line-height: 1.5;">This proposal outlines the strategy, timeline, and budget for redesigning the corporate website to improve user experience, increase mobile accessibility, and boost conversion rates by an estimated 25% within the first quarter post-launch.</p>
        </div>

        <h3 style="color: #1e3a8a; border-bottom: 1px solid #cbd5e1; padding-bottom: 5px;">1. Objectives</h3>
        <ul style="line-height: 1.6; margin-bottom: 20px;">
            <li>Modernize the visual identity of the brand.</li>
            <li>Implement responsive design for mobile and tablet users.</li>
            <li>Streamline navigation to reduce bounce rates.</li>
        </ul>

        <h3 style="color: #1e3a8a; border-bottom: 1px solid #cbd5e1; padding-bottom: 5px;">2. Timeline</h3>
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
            <tr style="background-color: #e2e8f0;">
                <th style="text-align: left; padding: 10px; border: 1px solid #cbd5e1;">Phase</th>
                <th style="text-align: left; padding: 10px; border: 1px solid #cbd5e1;">Deliverable</th>
                <th style="text-align: left; padding: 10px; border: 1px solid #cbd5e1;">Date</th>
            </tr>
            <tr>
                <td style="padding: 10px; border: 1px solid #cbd5e1;">Discovery</td>
                <td style="padding: 10px; border: 1px solid #cbd5e1;">Requirements Doc</td>
                <td style="padding: 10px; border: 1px solid #cbd5e1;">Nov 1</td>
            </tr>
            <tr>
                <td style="padding: 10px; border: 1px solid #cbd5e1;">Design</td>
                <td style="padding: 10px; border: 1px solid #cbd5e1;">UI Mockups</td>
                <td style="padding: 10px; border: 1px solid #cbd5e1;">Nov 15</td>
            </tr>
             <tr>
                <td style="padding: 10px; border: 1px solid #cbd5e1;">Development</td>
                <td style="padding: 10px; border: 1px solid #cbd5e1;">Beta Site</td>
                <td style="padding: 10px; border: 1px solid #cbd5e1;">Dec 10</td>
            </tr>
        </table>
      </div>
    `
  },
  {
    id: 'flyer-event',
    name: 'Event Flyer',
    nameKey: 'templateEventFlyer',
    category: 'Marketing',
    categoryKey: 'templateCategoryMarketing',
    thumbnail: 'bg-purple-900 border-none ring-2 ring-purple-300',
    pageConfig: {
      size: 'A4',
      orientation: 'portrait',
      margins: 'none'
    },
    content: `
      <div style="width: 100%; height: 297mm; background-color: #111827; color: white; font-family: 'Arial Black', sans-serif; text-align: center; overflow: hidden; position: relative;">
         
         <!-- Background accent -->
         <div style="position: absolute; top: -100px; right: -100px; width: 400px; height: 400px; background: #ec4899; filter: blur(100px); opacity: 0.5;"></div>
         <div style="position: absolute; bottom: -100px; left: -100px; width: 400px; height: 400px; background: #6366f1; filter: blur(100px); opacity: 0.5;"></div>

         <div style="position: relative; z-index: 10; padding: 60px 40px; height: 100%; box-sizing: border-box; display: flex; flex-direction: column; justify-content: center;">
            <p style="font-family: 'Arial', sans-serif; letter-spacing: 5px; text-transform: uppercase; color: #f472b6; margin-bottom: 20px;">Presents</p>
            
            <h1 style="font-size: 80px; line-height: 0.9; margin: 0; text-transform: uppercase; text-shadow: 4px 4px 0px #ec4899;">
                Summer<br>
                <span style="color: #6366f1;">Music</span><br>
                Fest
            </h1>

            <div style="width: 100px; height: 5px; background: white; margin: 40px auto;"></div>

            <div style="font-size: 24px; font-family: 'Arial', sans-serif; font-weight: bold; margin-bottom: 10px;">
                SATURDAY, JULY 15
            </div>
            <div style="font-size: 18px; font-family: 'Arial', sans-serif; opacity: 0.8; margin-bottom: 40px;">
                DOORS OPEN AT 8:00 PM
            </div>

            <div style="border: 2px solid white; padding: 20px; display: inline-block; margin: 0 auto 40px auto; width: 80%;">
                <p style="font-size: 14px; margin: 0; letter-spacing: 2px; text-transform: uppercase;">Featuring</p>
                <p style="font-size: 32px; margin: 10px 0;">THE NEON LIGHTS</p>
                <p style="font-size: 20px; margin: 0; opacity: 0.7;">+ SPECIAL GUESTS</p>
            </div>

            <p style="font-family: 'Arial', sans-serif; font-size: 16px;">
                CENTRAL PARK AMPHITHEATER<br>
                123 PARK AVENUE, NYC
            </p>
            
            <div style="margin-top: 50px;">
                <span style="background: #ec4899; color: white; padding: 15px 40px; font-size: 20px; font-weight: bold; border-radius: 50px;">GET TICKETS</span>
            </div>
         </div>
      </div>
    `
  },
  {
    id: 'academic-paper',
    name: 'Academic Paper (APA)',
    nameKey: 'templateAcademicPaper',
    category: 'Education',
    categoryKey: 'templateCategoryEducation',
    thumbnail: 'bg-white border border-gray-300 ring-2 ring-gray-100',
    content: `
      <div style="line-height: 2.0; font-family: 'Times New Roman', serif; font-size: 12pt; color: #000;">
        <div style="text-align: center; margin-top: 150px; margin-bottom: 150px;">
          <strong>The Impact of Artificial Intelligence on Modern Writing Tools</strong><br><br>
          Jane A. Doe<br>
          Department of Computer Science, University of Technology<br>
          CS101: Introduction to Software Engineering<br>
          Dr. Alan Turing<br>
          October 24, 2025
        </div>
        
        <div style="page-break-before: always; height: 1px; margin: 20px 0;"></div>
        
        <h3 style="text-align: center; font-weight: bold; margin-bottom: 20px;">Abstract</h3>
        <p style="text-indent: 0.5in; margin: 0;">This paper explores the evolution of word processing software, moving from basic text editors to cloud-based, AI-enhanced platforms. By analyzing user behavior and software capabilities, we demonstrate how offline-first capabilities combined with intelligent formatting suggestions can significantly improve writer productivity.</p>
        <p style="margin-top: 10px; font-style: italic;">Keywords: word processing, artificial intelligence, productivity, offline-first</p>
        
        <div style="page-break-before: always; height: 1px; margin: 20px 0;"></div>
        
        <h3 style="text-align: center; font-weight: bold; margin-bottom: 20px;">The Impact of Artificial Intelligence on Modern Writing Tools</h3>
        <p style="text-indent: 0.5in; margin-bottom: 10px;">Since the advent of the typewriter, writers have sought tools to make the transcription of thought more efficient. The digital revolution brought us the word processor, a tool that has remained largely unchanged in its fundamental paradigm for decades. However, recent advancements in browser capabilities have allowed for a new generation of editors.</p>
        
        <p style="text-indent: 0.5in; margin-bottom: 10px;">Modern applications must balance the need for robust feature sets with the demand for speed and simplicity. As noted by Smith (2023), "Users increasingly prefer interfaces that disappear, allowing them to focus solely on the content" (p. 45).</p>
        
        <h4 style="font-weight: bold; margin-top: 20px;">Methodology</h4>
        <p style="text-indent: 0.5in; margin-bottom: 10px;">We conducted a survey of 500 professional writers across various disciplines to understand their pain points with existing software solutions.</p>
        
        <h4 style="font-weight: bold; margin-top: 20px;">References</h4>
        <div style="padding-left: 0.5in; text-indent: -0.5in; margin-bottom: 10px;">Smith, J. (2023). <i>The Future of Text</i>. Academic Press.</div>
        <div style="padding-left: 0.5in; text-indent: -0.5in; margin-bottom: 10px;">Doe, J. (2024). <i>AI in the Browser</i>. Tech Monthly, 12(3), 45-50.</div>
      </div>
    `
  },
  {
    id: 'mla-essay',
    name: 'MLA Essay',
    nameKey: 'templateMLAEssay',
    category: 'Education',
    categoryKey: 'templateCategoryEducation',
    thumbnail: 'bg-blue-50 border border-blue-200 ring-2 ring-blue-100',
    content: `
      <div style="line-height: 2.0; font-family: 'Times New Roman', serif; font-size: 12pt; color: #000;">
        <div style="margin-bottom: 20px;">
          <div style="text-align: left;">Jane Doe</div>
          <div style="text-align: left;">Professor Smith</div>
          <div style="text-align: left;">English 101</div>
          <div style="text-align: left;">25 December 2025</div>
        </div>

        <h3 style="text-align: center; font-weight: bold; margin-bottom: 20px; margin-top: 20px;">The Evolution of Digital Writing: From Word Processors to Cloud-Based Editors</h3>

        <p style="text-indent: 0.5in; margin-bottom: 10px;">The landscape of digital writing has undergone a remarkable transformation over the past four decades. What began as simple text editors on early personal computers has evolved into sophisticated, cloud-based platforms that integrate artificial intelligence, real-time collaboration, and advanced formatting capabilities. This essay explores the key milestones in this evolution and examines how modern writing tools are reshaping the way we create and share written content.</p>

        <p style="text-indent: 0.5in; margin-bottom: 10px;">In the early 1980s, word processing software revolutionized writing by replacing typewriters with digital alternatives. Programs like WordStar and WordPerfect allowed users to edit text before printing, a capability that seems basic today but was groundbreaking at the time. As Smith notes in her comprehensive history of digital writing, "The ability to revise without retyping entire pages fundamentally changed the writing process" (45). This shift enabled writers to experiment more freely with their prose, leading to iterative refinement that was previously impractical.</p>

        <p style="text-indent: 0.5in; margin-bottom: 10px;">The 1990s brought graphical user interfaces and WYSIWYG (What You See Is What You Get) editing, exemplified by Microsoft Word and other commercial applications. These tools introduced features like spell-checking, formatting toolbars, and template libraries that made professional-looking documents accessible to casual users. However, these applications remained desktop-bound, tethering writers to specific computers and creating compatibility issues when sharing documents across different platforms.</p>

        <p style="text-indent: 0.5in; margin-bottom: 10px;">The advent of cloud computing in the 2000s marked another paradigm shift. Google Docs and similar platforms moved document storage and editing to remote servers, enabling access from any device with internet connectivity. This transition facilitated real-time collaboration, allowing multiple users to edit the same document simultaneously—a feature that has become indispensable in modern educational and professional settings. According to recent research by Johnson and Lee, "Cloud-based collaborative writing tools have increased team productivity by an average of 35% compared to traditional email-based document sharing" (112).</p>

        <p style="text-indent: 0.5in; margin-bottom: 10px;">Today's most advanced writing platforms incorporate artificial intelligence to suggest edits, detect plagiarism, and even generate content. These tools analyze writing patterns, recommend stylistic improvements, and provide contextual assistance that adapts to individual users' needs. While some critics worry about over-reliance on automated suggestions, proponents argue that these features democratize access to high-quality writing assistance previously available only through expensive human editors.</p>

        <p style="text-indent: 0.5in; margin-bottom: 10px;">Looking forward, the future of digital writing likely involves even greater integration of AI capabilities, improved offline functionality, and enhanced support for specialized formatting needs. As writers continue to demand tools that balance power with simplicity, developers face the ongoing challenge of creating software that enhances rather than constrains creative expression. The evolution from typewriters to cloud-based AI-assisted editors demonstrates technology's profound impact on the writing process, and this transformation shows no signs of slowing.</p>

        <div style="page-break-before: always; height: 1px; margin: 20px 0;"></div>

        <h3 style="text-align: center; font-weight: bold; margin-bottom: 20px;">Works Cited</h3>
        <div style="padding-left: 0.5in; text-indent: -0.5in; margin-bottom: 10px;">Johnson, Robert, and Sarah Lee. "Collaborative Writing in the Digital Age: A Productivity Analysis." <i>Journal of Modern Communication</i>, vol. 28, no. 2, 2024, pp. 105-120.</div>
        <div style="padding-left: 0.5in; text-indent: -0.5in; margin-bottom: 10px;">Smith, Elizabeth. <i>A History of Digital Writing: From WordStar to AI</i>. Academic Press, 2023.</div>
      </div>
    `
  },
  {
    id: 'ieee-paper',
    name: 'IEEE Conference Paper',
    nameKey: 'templateIEEEPaper',
    category: 'Education',
    categoryKey: 'templateCategoryEducation',
    thumbnail: 'bg-gradient-to-br from-slate-50 to-gray-100 border border-slate-300 ring-2 ring-slate-200',
    content: `
      <div style="font-family: 'Times New Roman', serif; font-size: 10pt; color: #000; max-width: 8.5in; margin: 0 auto;">
        <!-- Title and Authors (Full Width) -->
        <div style="text-align: center; margin-bottom: 20px;">
          <h1 style="font-size: 24pt; font-weight: bold; margin-bottom: 15px;">Advanced Machine Learning Techniques for Natural Language Processing</h1>
          <p style="font-size: 12pt; margin-bottom: 5px;">
            <strong>Jane A. Doe</strong>, <strong>John B. Smith</strong>, and <strong>Alan M. Turing</strong>
          </p>
          <p style="font-size: 10pt; font-style: italic; margin-bottom: 3px;">
            Department of Computer Science, University of Technology
          </p>
          <p style="font-size: 10pt; font-style: italic;">
            {jane.doe, john.smith, alan.turing}@university.edu
          </p>
        </div>

        <!-- Two-Column Layout -->
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.25in; column-gap: 0.25in;">
          <!-- Left Column -->
          <div>
            <p style="margin-bottom: 10px;"><strong><em>Abstract</em></strong>—This paper presents a comprehensive study of advanced machine learning techniques applied to natural language processing tasks. We introduce a novel architecture that combines transformer-based models with reinforcement learning to achieve state-of-the-art results on multiple benchmarks. Our approach demonstrates significant improvements in accuracy, efficiency, and generalization capabilities compared to existing methods.</p>

            <p style="margin-bottom: 10px;"><strong><em>Keywords</em></strong>—machine learning, natural language processing, transformers, reinforcement learning, deep learning</p>

            <h3 style="font-size: 11pt; font-weight: bold; margin-top: 15px; margin-bottom: 8px;">I. INTRODUCTION</h3>

            <p style="text-align: justify; margin-bottom: 10px;">Natural Language Processing (NLP) has experienced remarkable growth over the past decade, driven primarily by advances in deep learning and the availability of large-scale datasets [1]. Traditional approaches to NLP relied heavily on hand-crafted features and linguistic rules, which limited their ability to generalize across different domains and languages.</p>

            <p style="text-align: justify; margin-bottom: 10px;">The introduction of neural network-based models, particularly recurrent neural networks (RNNs) and long short-term memory (LSTM) networks, marked a significant paradigm shift in the field. These models demonstrated the ability to learn complex patterns directly from data, eliminating the need for extensive feature engineering [2], [3].</p>

            <p style="text-align: justify; margin-bottom: 10px;">More recently, transformer-based architectures have become the dominant approach in NLP, achieving unprecedented performance across a wide range of tasks including machine translation, question answering, and text summarization [4]. However, these models often require substantial computational resources and large amounts of training data, limiting their accessibility and applicability in resource-constrained environments.</p>

            <h3 style="font-size: 11pt; font-weight: bold; margin-top: 15px; margin-bottom: 8px;">II. RELATED WORK</h3>

            <p style="text-align: justify; margin-bottom: 10px;">The field of NLP has been revolutionized by several key developments. Word embeddings, introduced by Mikolov et al. [5], provided dense vector representations that captured semantic relationships between words. This was followed by contextualized word representations such as ELMo [6] and BERT [7], which generated word embeddings based on the surrounding context.</p>

            <p style="text-align: justify; margin-bottom: 10px;">The transformer architecture, proposed by Vaswani et al. [4], introduced the self-attention mechanism that allows models to weigh the importance of different words in a sequence. This innovation led to the development of powerful pre-trained models such as GPT [8] and T5 [9], which have set new benchmarks across numerous NLP tasks.</p>
          </div>

          <!-- Right Column -->
          <div>
            <p style="text-align: justify; margin-bottom: 10px;">Reinforcement learning has also been applied to NLP with notable success. Policy gradient methods have been used to optimize non-differentiable metrics such as BLEU scores in machine translation [10]. Recent work has explored combining reinforcement learning with large language models to improve their alignment with human preferences [11].</p>

            <h3 style="font-size: 11pt; font-weight: bold; margin-top: 15px; margin-bottom: 8px;">III. METHODOLOGY</h3>

            <p style="text-align: justify; margin-bottom: 10px;">Our proposed architecture consists of three main components: a transformer-based encoder, a reinforcement learning module, and an adaptive attention mechanism. The encoder processes input sequences and generates contextualized representations, while the reinforcement learning module optimizes the model's predictions based on task-specific rewards.</p>

            <p style="text-align: justify; margin-bottom: 10px;">The adaptive attention mechanism dynamically adjusts the attention weights based on the relevance of different input tokens to the current prediction task. This allows the model to focus on the most informative parts of the input, improving both accuracy and computational efficiency.</p>

            <h3 style="font-size: 11pt; font-weight: bold; margin-top: 15px; margin-bottom: 8px;">IV. EXPERIMENTAL RESULTS</h3>

            <p style="text-align: justify; margin-bottom: 10px;">We evaluated our approach on three standard NLP benchmarks: SQuAD 2.0 for question answering, GLUE for general language understanding, and WMT for machine translation. Our model achieved competitive or superior performance compared to existing state-of-the-art methods across all three datasets.</p>

            <p style="text-align: justify; margin-bottom: 10px;">On SQuAD 2.0, our model achieved an F1 score of 92.3%, outperforming the previous best result by 1.7%. For GLUE, we obtained an average score of 89.1% across all tasks, representing a 2.3% improvement over the baseline. In machine translation, our approach achieved a BLEU score of 34.5 on the WMT English-to-German test set.</p>

            <h3 style="font-size: 11pt; font-weight: bold; margin-top: 15px; margin-bottom: 8px;">V. CONCLUSION</h3>

            <p style="text-align: justify; margin-bottom: 10px;">This paper presented a novel approach to NLP that combines transformer architectures with reinforcement learning. Our experimental results demonstrate that this hybrid approach can achieve state-of-the-art performance while maintaining computational efficiency. Future work will explore the application of this methodology to multilingual settings and low-resource languages.</p>

            <h3 style="font-size: 11pt; font-weight: bold; margin-top: 15px; margin-bottom: 8px;">REFERENCES</h3>

            <p style="font-size: 9pt; margin-bottom: 5px; text-indent: -0.2in; padding-left: 0.2in;">[1] Y. Goldberg, "Neural network methods for natural language processing," <em>Synthesis Lectures on Human Language Technologies</em>, vol. 10, no. 1, pp. 1-309, 2017.</p>

            <p style="font-size: 9pt; margin-bottom: 5px; text-indent: -0.2in; padding-left: 0.2in;">[2] S. Hochreiter and J. Schmidhuber, "Long short-term memory," <em>Neural Computation</em>, vol. 9, no. 8, pp. 1735-1780, 1997.</p>

            <p style="font-size: 9pt; margin-bottom: 5px; text-indent: -0.2in; padding-left: 0.2in;">[3] K. Cho et al., "Learning phrase representations using RNN encoder-decoder for statistical machine translation," in <em>Proc. EMNLP</em>, 2014, pp. 1724-1734.</p>

            <p style="font-size: 9pt; margin-bottom: 5px; text-indent: -0.2in; padding-left: 0.2in;">[4] A. Vaswani et al., "Attention is all you need," in <em>Advances in Neural Information Processing Systems</em>, 2017, pp. 5998-6008.</p>
          </div>
        </div>
      </div>
    `
  },
  {
    id: 'thesis',
    name: 'Thesis/Dissertation',
    nameKey: 'templateThesis',
    category: 'Education',
    categoryKey: 'templateCategoryEducation',
    thumbnail: 'bg-gradient-to-br from-indigo-50 to-purple-50 border border-indigo-200 ring-2 ring-indigo-100',
    content: `
      <div style="line-height: 2.0; font-family: 'Times New Roman', serif; font-size: 12pt; color: #000;">
        <!-- Title Page -->
        <div style="text-align: center; margin-top: 150px; margin-bottom: 150px;">
          <h1 style="font-size: 18pt; font-weight: bold; margin-bottom: 40px; text-transform: uppercase;">Machine Learning Approaches to Natural Language Understanding: A Comprehensive Analysis</h1>

          <p style="margin-bottom: 20px;">A Dissertation</p>
          <p style="margin-bottom: 20px;">Presented to</p>
          <p style="margin-bottom: 20px;">The Faculty of the Graduate School</p>
          <p style="margin-bottom: 20px;">University of Technology</p>

          <p style="margin-top: 40px; margin-bottom: 20px;">In Partial Fulfillment</p>
          <p style="margin-bottom: 20px;">of the Requirements for the Degree</p>
          <p style="margin-bottom: 20px;"><strong>Doctor of Philosophy</strong></p>

          <p style="margin-top: 40px; margin-bottom: 10px;">By</p>
          <p style="margin-bottom: 60px;"><strong>Jane Alexandria Doe</strong></p>

          <p>December 2025</p>
        </div>

        <div style="page-break-before: always; height: 1px; margin: 20px 0;"></div>

        <!-- Abstract -->
        <div style="text-align: center; margin-bottom: 30px;">
          <h2 style="font-weight: bold;">ABSTRACT</h2>
        </div>

        <p style="text-indent: 0.5in; margin-bottom: 10px;">This dissertation investigates the application of modern machine learning techniques to natural language understanding tasks. Through a series of empirical studies, we demonstrate that hybrid architectures combining traditional linguistic knowledge with data-driven approaches can significantly outperform purely statistical methods across a range of benchmarks.</p>

        <p style="text-indent: 0.5in; margin-bottom: 10px;">The research is organized into three main contributions: First, we introduce a novel attention mechanism that incorporates syntactic structure into transformer-based models. Second, we develop a transfer learning framework that enables efficient adaptation to low-resource languages. Third, we present a comprehensive evaluation methodology for assessing model robustness and interpretability.</p>

        <p style="text-indent: 0.5in; margin-bottom: 10px;">Our experimental results across five languages and ten distinct tasks show consistent improvements over baseline approaches, with particularly strong performance on semantic role labeling and question answering. The proposed methods reduce training data requirements by an average of 40% while maintaining or improving accuracy.</p>

        <div style="page-break-before: always; height: 1px; margin: 20px 0;"></div>

        <!-- Table of Contents -->
        <div style="text-align: center; margin-bottom: 30px;">
          <h2 style="font-weight: bold;">TABLE OF CONTENTS</h2>
        </div>

        <p style="margin-bottom: 8px;">CHAPTER</p>
        <p style="margin-bottom: 8px; padding-left: 0.5in;">1. INTRODUCTION ......................................... 1</p>
        <p style="margin-bottom: 8px; padding-left: 1in;">1.1 Background and Motivation ........................ 1</p>
        <p style="margin-bottom: 8px; padding-left: 1in;">1.2 Research Questions ............................... 3</p>
        <p style="margin-bottom: 8px; padding-left: 1in;">1.3 Dissertation Organization ........................ 5</p>

        <p style="margin-bottom: 8px; padding-left: 0.5in; margin-top: 15px;">2. LITERATURE REVIEW ................................... 7</p>
        <p style="margin-bottom: 8px; padding-left: 1in;">2.1 Traditional NLP Approaches ....................... 7</p>
        <p style="margin-bottom: 8px; padding-left: 1in;">2.2 Neural Network Methods .......................... 12</p>
        <p style="margin-bottom: 8px; padding-left: 1in;">2.3 Transformer Architectures ....................... 18</p>

        <p style="margin-bottom: 8px; padding-left: 0.5in; margin-top: 15px;">3. METHODOLOGY ......................................... 25</p>
        <p style="margin-bottom: 8px; padding-left: 1in;">3.1 Proposed Architecture ........................... 25</p>
        <p style="margin-bottom: 8px; padding-left: 1in;">3.2 Training Procedures ............................. 31</p>
        <p style="margin-bottom: 8px; padding-left: 1in;">3.3 Evaluation Framework ............................ 37</p>

        <div style="page-break-before: always; height: 1px; margin: 20px 0;"></div>

        <!-- Chapter 1 -->
        <div style="text-align: center; margin-bottom: 30px;">
          <h2 style="font-weight: bold;">CHAPTER 1</h2>
          <h3 style="font-weight: bold;">INTRODUCTION</h3>
        </div>

        <h4 style="font-weight: bold; margin-bottom: 10px;">1.1 Background and Motivation</h4>

        <p style="text-indent: 0.5in; margin-bottom: 10px;">Natural language processing has emerged as one of the most active areas of research in artificial intelligence, driven by the convergence of large-scale datasets, powerful computational resources, and innovative algorithmic approaches. The ability to automatically process and understand human language has profound implications for information retrieval, machine translation, dialogue systems, and countless other applications.</p>

        <p style="text-indent: 0.5in; margin-bottom: 10px;">Despite remarkable progress in recent years, significant challenges remain. Current state-of-the-art models often require enormous amounts of training data and computational resources, making them inaccessible for many languages and domains. Furthermore, these models frequently exhibit brittleness when faced with distribution shifts or adversarial inputs, raising questions about their reliability in real-world deployments.</p>

        <p style="text-indent: 0.5in; margin-bottom: 10px;">This dissertation addresses these limitations by developing methods that combine the strengths of data-driven learning with structured linguistic knowledge. Our approach aims to create models that are more sample-efficient, robust, and interpretable than current alternatives.</p>
      </div>
    `
  },
  {
    id: 'lab-report',
    name: 'Lab Report',
    nameKey: 'templateLabReport',
    category: 'Education',
    categoryKey: 'templateCategoryEducation',
    thumbnail: 'bg-gradient-to-br from-cyan-50 to-blue-50 border border-cyan-200',
    content: `
      <div style="font-family: 'Arial', sans-serif; font-size: 11pt; color: #000;">
        <!-- Header -->
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="font-size: 18pt; font-weight: bold; margin-bottom: 15px;">Chemical Kinetics: Rate of Reaction Between Hydrochloric Acid and Sodium Thiosulfate</h1>
          <p style="margin-bottom: 5px;"><strong>Jane Doe, John Smith, Alex Johnson</strong></p>
          <p style="margin-bottom: 5px;">Chemistry 201 - Section B</p>
          <p style="margin-bottom: 5px;">Professor Dr. Marie Curie</p>
          <p>Date Performed: December 20, 2025 | Date Submitted: December 25, 2025</p>
        </div>

        <!-- Abstract -->
        <h3 style="font-weight: bold; margin-bottom: 10px;">ABSTRACT</h3>
        <p style="text-align: justify; margin-bottom: 20px;">This experiment investigated the effect of concentration on the rate of reaction between hydrochloric acid (HCl) and sodium thiosulfate (Na₂S₂O₃). Five different concentrations of HCl were tested while keeping the temperature and volume constant. Results showed an inverse relationship between concentration and reaction time, confirming that increased reactant concentration leads to faster reaction rates. The data supported the collision theory of chemical kinetics.</p>

        <!-- Introduction -->
        <h3 style="font-weight: bold; margin-bottom: 10px;">INTRODUCTION</h3>
        <p style="text-align: justify; margin-bottom: 10px;">Chemical kinetics is the study of reaction rates and the factors that affect them. According to collision theory, chemical reactions occur when reactant molecules collide with sufficient energy and proper orientation. The rate of reaction is influenced by several factors including concentration, temperature, surface area, and the presence of catalysts.</p>

        <p style="text-align: justify; margin-bottom: 10px;">When sodium thiosulfate reacts with hydrochloric acid, a precipitate of sulfur forms, gradually making the solution cloudy. The reaction can be represented by the equation:</p>

        <p style="text-align: center; margin: 15px 0; font-family: 'Courier New', monospace;">Na₂S₂O₃(aq) + 2HCl(aq) → 2NaCl(aq) + H₂O(l) + SO₂(g) + S(s)</p>

        <p style="text-align: justify; margin-bottom: 10px;"><strong>Objective:</strong> To determine how the concentration of hydrochloric acid affects the rate of reaction with sodium thiosulfate.</p>

        <p style="text-align: justify; margin-bottom: 20px;"><strong>Hypothesis:</strong> Increasing the concentration of HCl will decrease the time required for the solution to become opaque, indicating a faster reaction rate.</p>

        <!-- Materials and Methods -->
        <h3 style="font-weight: bold; margin-bottom: 10px;">MATERIALS AND METHODS</h3>

        <h4 style="font-weight: bold; margin-top: 15px; margin-bottom: 8px;">Materials:</h4>
        <ul style="margin-left: 25px; margin-bottom: 15px;">
          <li>Hydrochloric acid (HCl) - 2.0 M stock solution</li>
          <li>Sodium thiosulfate (Na₂S₂O₃) - 0.1 M solution</li>
          <li>Distilled water</li>
          <li>5 conical flasks (250 mL)</li>
          <li>Graduated cylinders (50 mL and 100 mL)</li>
          <li>Stopwatch</li>
          <li>White paper with black "X" mark</li>
          <li>Safety goggles and lab coat</li>
        </ul>

        <h4 style="font-weight: bold; margin-bottom: 8px;">Procedure:</h4>
        <ol style="margin-left: 25px; margin-bottom: 20px;">
          <li>Prepare five different concentrations of HCl by dilution: 2.0 M, 1.5 M, 1.0 M, 0.5 M, and 0.25 M</li>
          <li>Place a conical flask on white paper marked with a black "X"</li>
          <li>Add 50 mL of sodium thiosulfate solution to the flask</li>
          <li>Add 10 mL of HCl solution and immediately start the stopwatch</li>
          <li>Observe the solution from above and stop the timer when the "X" is no longer visible</li>
          <li>Record the time and repeat for all concentrations</li>
          <li>Conduct three trials for each concentration and calculate the average</li>
        </ol>

        <!-- Results -->
        <h3 style="font-weight: bold; margin-bottom: 10px;">RESULTS</h3>
        <p style="margin-bottom: 15px;">The following data was collected:</p>

        <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
          <tr style="background-color: #e0f2fe;">
            <th style="border: 1px solid #999; padding: 10px; text-align: center;">HCl Concentration (M)</th>
            <th style="border: 1px solid #999; padding: 10px; text-align: center;">Trial 1 (s)</th>
            <th style="border: 1px solid #999; padding: 10px; text-align: center;">Trial 2 (s)</th>
            <th style="border: 1px solid #999; padding: 10px; text-align: center;">Trial 3 (s)</th>
            <th style="border: 1px solid #999; padding: 10px; text-align: center;">Average (s)</th>
            <th style="border: 1px solid #999; padding: 10px; text-align: center;">Rate (1/time)</th>
          </tr>
          <tr>
            <td style="border: 1px solid #999; padding: 10px; text-align: center;">2.0</td>
            <td style="border: 1px solid #999; padding: 10px; text-align: center;">12.3</td>
            <td style="border: 1px solid #999; padding: 10px; text-align: center;">11.8</td>
            <td style="border: 1px solid #999; padding: 10px; text-align: center;">12.1</td>
            <td style="border: 1px solid #999; padding: 10px; text-align: center;">12.1</td>
            <td style="border: 1px solid #999; padding: 10px; text-align: center;">0.083</td>
          </tr>
          <tr style="background-color: #f0f9ff;">
            <td style="border: 1px solid #999; padding: 10px; text-align: center;">1.5</td>
            <td style="border: 1px solid #999; padding: 10px; text-align: center;">18.5</td>
            <td style="border: 1px solid #999; padding: 10px; text-align: center;">17.9</td>
            <td style="border: 1px solid #999; padding: 10px; text-align: center;">18.2</td>
            <td style="border: 1px solid #999; padding: 10px; text-align: center;">18.2</td>
            <td style="border: 1px solid #999; padding: 10px; text-align: center;">0.055</td>
          </tr>
          <tr>
            <td style="border: 1px solid #999; padding: 10px; text-align: center;">1.0</td>
            <td style="border: 1px solid #999; padding: 10px; text-align: center;">29.4</td>
            <td style="border: 1px solid #999; padding: 10px; text-align: center;">28.7</td>
            <td style="border: 1px solid #999; padding: 10px; text-align: center;">29.1</td>
            <td style="border: 1px solid #999; padding: 10px; text-align: center;">29.1</td>
            <td style="border: 1px solid #999; padding: 10px; text-align: center;">0.034</td>
          </tr>
          <tr style="background-color: #f0f9ff;">
            <td style="border: 1px solid #999; padding: 10px; text-align: center;">0.5</td>
            <td style="border: 1px solid #999; padding: 10px; text-align: center;">61.2</td>
            <td style="border: 1px solid #999; padding: 10px; text-align: center;">59.8</td>
            <td style="border: 1px solid #999; padding: 10px; text-align: center;">60.5</td>
            <td style="border: 1px solid #999; padding: 10px; text-align: center;">60.5</td>
            <td style="border: 1px solid #999; padding: 10px; text-align: center;">0.017</td>
          </tr>
          <tr>
            <td style="border: 1px solid #999; padding: 10px; text-align: center;">0.25</td>
            <td style="border: 1px solid #999; padding: 10px; text-align: center;">125.3</td>
            <td style="border: 1px solid #999; padding: 10px; text-align: center;">123.7</td>
            <td style="border: 1px solid #999; padding: 10px; text-align: center;">124.5</td>
            <td style="border: 1px solid #999; padding: 10px; text-align: center;">124.5</td>
            <td style="border: 1px solid #999; padding: 10px; text-align: center;">0.008</td>
          </tr>
        </table>

        <!-- Discussion -->
        <h3 style="font-weight: bold; margin-bottom: 10px;">DISCUSSION</h3>
        <p style="text-align: justify; margin-bottom: 10px;">The experimental results clearly demonstrate an inverse relationship between HCl concentration and reaction time. As the concentration of HCl increased from 0.25 M to 2.0 M, the average reaction time decreased from 124.5 seconds to 12.1 seconds. This represents a tenfold decrease in reaction time corresponding to an eightfold increase in concentration.</p>

        <p style="text-align: justify; margin-bottom: 10px;">These findings support the hypothesis and are consistent with collision theory. Higher concentrations of reactants result in more frequent collisions between molecules, leading to an increased probability of successful reactions per unit time. The reaction rate, calculated as the reciprocal of time (1/t), shows a directly proportional relationship with concentration.</p>

        <p style="text-align: justify; margin-bottom: 20px;">Minor variations between trials were observed, likely due to slight differences in mixing efficiency and human reaction time when stopping the stopwatch. These variations were minimal (standard deviation < 2%), indicating good experimental reproducibility.</p>

        <!-- Conclusion -->
        <h3 style="font-weight: bold; margin-bottom: 10px;">CONCLUSION</h3>
        <p style="text-align: justify; margin-bottom: 10px;">This experiment successfully demonstrated that increasing the concentration of hydrochloric acid increases the rate of reaction with sodium thiosulfate. The inverse relationship between concentration and reaction time confirmed the predictions of collision theory. The experimental data showed clear, reproducible trends that supported the hypothesis.</p>

        <p style="text-align: justify; margin-bottom: 10px;">Future experiments could investigate the effects of temperature and the use of catalysts on this reaction system to gain a more comprehensive understanding of the factors affecting reaction rates.</p>

        <!-- References -->
        <h3 style="font-weight: bold; margin-bottom: 10px; margin-top: 20px;">REFERENCES</h3>
        <ol style="margin-left: 25px;">
          <li>Atkins, P., & de Paula, J. (2022). <em>Physical Chemistry</em> (12th ed.). Oxford University Press.</li>
          <li>Brown, T. E., LeMay, H. E., & Bursten, B. E. (2021). <em>Chemistry: The Central Science</em> (15th ed.). Pearson.</li>
          <li>Laboratory Manual for Chemistry 201. (2025). University of Technology Press.</li>
        </ol>
      </div>
    `
  },
  {
    id: 'lesson-plan',
    name: 'Lesson Plan',
    nameKey: 'templateLessonPlan',
    category: 'Education',
    categoryKey: 'templateCategoryEducation',
    thumbnail: 'bg-green-50 border border-green-200',
    content: `
      <div style="font-family: 'Arial', sans-serif;">
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px; background-color: #f0fdf4;">
            <tr>
                <td style="padding: 15px; border-bottom: 2px solid #16a34a;">
                    <h2 style="margin: 0; color: #166534;">LESSON PLAN</h2>
                </td>
                <td style="padding: 15px; border-bottom: 2px solid #16a34a; text-align: right;">
                    <strong>Date:</strong> ___________<br>
                    <strong>Grade:</strong> ___________
                </td>
            </tr>
        </table>

        <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
            <tr>
                <td style="padding: 8px; font-weight: bold; width: 150px; background-color: #eee;">Subject/Topic:</td>
                <td style="padding: 8px; border-bottom: 1px solid #ccc;">Introduction to Photosynthesis</td>
            </tr>
            <tr>
                <td style="padding: 8px; font-weight: bold; width: 150px; background-color: #eee;">Teacher:</td>
                <td style="padding: 8px; border-bottom: 1px solid #ccc;">Mr. Science</td>
            </tr>
        </table>

        <div style="margin-bottom: 20px;">
            <h3 style="background-color: #166534; color: white; padding: 5px 10px; font-size: 14px; margin-bottom: 10px;">OBJECTIVES</h3>
            <ul style="line-height: 1.5;">
                <li>Students will be able to define photosynthesis.</li>
                <li>Students will identify the inputs and outputs of the process.</li>
                <li>Students will understand the importance of plants in the ecosystem.</li>
            </ul>
        </div>

        <div style="margin-bottom: 20px;">
            <h3 style="background-color: #166534; color: white; padding: 5px 10px; font-size: 14px; margin-bottom: 10px;">MATERIALS</h3>
            <p>Textbook, plant samples, diagram worksheets, projector.</p>
        </div>

        <h3 style="background-color: #166534; color: white; padding: 5px 10px; font-size: 14px; margin-bottom: 10px;">LESSON OUTLINE</h3>
        <table style="width: 100%; border-collapse: collapse; border: 1px solid #ccc;">
            <thead>
                <tr style="background-color: #f0f0f0;">
                    <th style="padding: 8px; border: 1px solid #ccc; width: 15%;">Time</th>
                    <th style="padding: 8px; border: 1px solid #ccc;">Activity</th>
                    <th style="padding: 8px; border: 1px solid #ccc; width: 25%;">Notes</th>
                </tr>
            </thead>
            <tbody>
                <tr>
                    <td style="padding: 8px; border: 1px solid #ccc;">10 min</td>
                    <td style="padding: 8px; border: 1px solid #ccc;">Warm-up discussion: "How do plants eat?"</td>
                    <td style="padding: 8px; border: 1px solid #ccc;">Engage students</td>
                </tr>
                <tr>
                    <td style="padding: 8px; border: 1px solid #ccc;">20 min</td>
                    <td style="padding: 8px; border: 1px solid #ccc;">Direct Instruction / Slide Presentation</td>
                    <td style="padding: 8px; border: 1px solid #ccc;">Visual aids</td>
                </tr>
                <tr>
                    <td style="padding: 8px; border: 1px solid #ccc;">15 min</td>
                    <td style="padding: 8px; border: 1px solid #ccc;">Group Activity: Labeling the Diagram</td>
                    <td style="padding: 8px; border: 1px solid #ccc;">Pairs</td>
                </tr>
                 <tr>
                    <td style="padding: 8px; border: 1px solid #ccc;">10 min</td>
                    <td style="padding: 8px; border: 1px solid #ccc;">Exit Ticket Quiz</td>
                    <td style="padding: 8px; border: 1px solid #ccc;">Assessment</td>
                </tr>
            </tbody>
        </table>
      </div>
    `
  },
  {
    id: 'recipe',
    name: 'Recipe Card',
    nameKey: 'templateRecipeCard',
    category: 'Personal',
    categoryKey: 'templateCategoryPersonal',
    thumbnail: 'bg-orange-50 border border-orange-100',
    content: `
      <div style="font-family: 'Arial', sans-serif; color: #444;">
        <h1 style="color: #e67e22; text-align: center; font-family: 'Georgia', serif; font-style: italic; font-size: 28pt; margin-bottom: 10px;">Classic Chocolate Chip Cookies</h1>
        
        <div style="background-color: #fff7ed; padding: 15px; border-radius: 8px; text-align: center; margin: 20px 0; border: 1px solid #ffedd5;">
          <span style="margin: 0 15px; font-weight: bold;">⏱ Prep: 15 min</span>
          <span style="margin: 0 15px; font-weight: bold;">🔥 Cook: 10 min</span>
          <span style="margin: 0 15px; font-weight: bold;">🍪 Yields: 24 cookies</span>
        </div>

        <table style="width: 100%; border-collapse: collapse; margin-top: 30px;">
          <tr>
            <td style="width: 40%; vertical-align: top; padding-right: 20px;">
              <h3 style="border-bottom: 2px solid #e67e22; color: #c05621; text-transform: uppercase; letter-spacing: 1px; font-size: 14px;">Ingredients</h3>
              <ul style="line-height: 1.8; list-style-type: square; padding-left: 20px; color: #555;">
                <li>2 ¼ cups flour</li>
                <li>1 tsp baking soda</li>
                <li>1 tsp salt</li>
                <li>1 cup butter</li>
                <li>¾ cup sugar</li>
                <li>¾ cup brown sugar</li>
                <li>1 tsp vanilla</li>
                <li>2 eggs</li>
                <li>2 cups chocolate chips</li>
              </ul>
            </td>
            <td style="width: 60%; vertical-align: top; padding-left: 20px; border-left: 2px solid #ffedd5;">
              <h3 style="border-bottom: 2px solid #e67e22; color: #c05621; text-transform: uppercase; letter-spacing: 1px; font-size: 14px;">Instructions</h3>
              <ol style="line-height: 1.8; padding-left: 20px; color: #555;">
                <li><strong>Preheat</strong> oven to 375°F (190°C).</li>
                <li><strong>Mix</strong> flour, baking soda, and salt in a small bowl.</li>
                <li><strong>Beat</strong> butter, granulated sugar, brown sugar, and vanilla extract in large mixer bowl until creamy.</li>
                <li><strong>Add</strong> eggs, one at a time, beating well after each addition. Gradually beat in flour mixture. Stir in morsels.</li>
                <li><strong>Drop</strong> by rounded tablespoon onto ungreased baking sheets.</li>
                <li><strong>Bake</strong> for 9 to 11 minutes or until golden brown. Cool on baking sheets for 2 minutes.</li>
              </ol>
            </td>
          </tr>
        </table>
        
        <div style="margin-top: 40px; padding: 15px; border: 2px dashed #e67e22; border-radius: 8px; text-align: center; font-style: italic; background-color: #fff; color: #c05621;">
          "The best cookies are made with love... and extra chocolate."
        </div>
      </div>
    `
  },
  {
    id: 'certificate',
    name: 'Award Certificate',
    nameKey: 'templateAwardCertificate',
    category: 'Personal',
    categoryKey: 'templateCategoryPersonal',
    thumbnail: 'bg-yellow-50 border border-yellow-200',
    pageConfig: {
      size: 'A4',
      orientation: 'landscape',
      margins: 'none'
    },
    content: `
      <div style="width: 100%; height: 210mm; padding: 15mm; box-sizing: border-box; background: white;">
        <div style="border: 10px double #ca8a04; height: 100%; padding: 10px; box-sizing: border-box; position: relative;">
           <!-- Corner Decorations -->
           <div style="position: absolute; top: 0; left: 0; width: 50px; height: 50px; border-top: 10px solid #ca8a04; border-left: 10px solid #ca8a04;"></div>
           <div style="position: absolute; top: 0; right: 0; width: 50px; height: 50px; border-top: 10px solid #ca8a04; border-right: 10px solid #ca8a04;"></div>
           <div style="position: absolute; bottom: 0; left: 0; width: 50px; height: 50px; border-bottom: 10px solid #ca8a04; border-left: 10px solid #ca8a04;"></div>
           <div style="position: absolute; bottom: 0; right: 0; width: 50px; height: 50px; border-bottom: 10px solid #ca8a04; border-right: 10px solid #ca8a04;"></div>

           <div style="text-align: center; display: flex; flex-direction: column; justify-content: center; height: 100%;">
              <h1 style="font-family: 'Times New Roman', serif; font-size: 60px; color: #854d0e; margin: 0; text-transform: uppercase; letter-spacing: 5px;">Certificate</h1>
              <h2 style="font-family: 'Arial', sans-serif; font-size: 24px; color: #a16207; margin-top: 10px; font-weight: normal;">OF APPRECIATION</h2>
              
              <p style="margin-top: 40px; font-size: 18px; font-family: 'Arial', sans-serif; color: #444;">THIS CERTIFICATE IS PROUDLY PRESENTED TO</p>
              
              <div style="font-family: 'Times New Roman', serif; font-size: 48px; border-bottom: 2px solid #ca8a04; display: inline-block; margin: 10px auto; padding: 0 40px; color: #000; font-style: italic;">
                 John Q. Citizen
              </div>
              
              <p style="margin-top: 30px; font-size: 16px; font-family: 'Arial', sans-serif; color: #555; max-width: 600px; margin-left: auto; margin-right: auto; line-height: 1.5;">
                In recognition of outstanding contribution and dedication to the community service project held in October 2025. Your efforts have made a lasting impact.
              </p>

              <div style="margin-top: 60px; display: flex; justify-content: space-around;">
                  <div style="text-align: center;">
                      <div style="border-bottom: 1px solid #000; width: 200px; margin-bottom: 5px;"></div>
                      <span style="font-size: 14px;">Signature</span>
                  </div>
                  
                  <div style="width: 80px; height: 80px; background: #ca8a04; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: white; font-weight: bold; font-size: 12px; border: 4px solid #fef08a; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
                     SEAL
                  </div>

                  <div style="text-align: center;">
                      <div style="border-bottom: 1px solid #000; width: 200px; margin-bottom: 5px;">Oct 24, 2025</div>
                      <span style="font-size: 14px;">Date</span>
                  </div>
              </div>
           </div>
        </div>
      </div>
    `
  },
  {
    id: 'brochure',
    name: 'Tri-Fold Brochure',
    nameKey: 'templateBrochure',
    category: 'Marketing',
    categoryKey: 'templateCategoryMarketing',
    thumbnail: 'bg-blue-50 border border-blue-200',
    pageConfig: {
      size: 'A4',
      orientation: 'landscape',
      margins: 'none'
    },
    content: `
      <div style="width: 100%; height: 210mm; background: white; font-family: 'Arial', sans-serif;">
         <table style="width: 100%; height: 100%; border-collapse: collapse;">
            <tr>
               <!-- LEFT PANEL (Inside Flap) -->
               <td style="width: 33.33%; padding: 40px 30px; vertical-align: top; border-right: 1px dashed #ddd; background-color: #eff6ff;">
                  <h2 style="color: #1e40af; font-size: 24px;">Our Services</h2>
                  <p style="color: #444; line-height: 1.6; font-size: 14px; margin-bottom: 20px;">We offer a wide range of solutions tailored to your needs. From consulting to implementation.</p>
                  
                  <div style="margin-bottom: 15px;">
                      <strong style="color: #1e3a8a;">01. Strategy</strong>
                      <p style="font-size: 13px; color: #666; margin-top: 5px;">Planning for long term success with data-driven insights.</p>
                  </div>
                  <div style="margin-bottom: 15px;">
                      <strong style="color: #1e3a8a;">02. Design</strong>
                      <p style="font-size: 13px; color: #666; margin-top: 5px;">Creating beautiful, functional interfaces that users love.</p>
                  </div>
                  <div style="margin-bottom: 15px;">
                      <strong style="color: #1e3a8a;">03. Development</strong>
                      <p style="font-size: 13px; color: #666; margin-top: 5px;">Robust code built on modern technology stacks.</p>
                  </div>
               </td>

               <!-- MIDDLE PANEL (Back Cover) -->
               <td style="width: 33.33%; padding: 40px 30px; vertical-align: top; border-right: 1px dashed #ddd;">
                   <h2 style="color: #1e40af; font-size: 24px; text-align: center;">Contact Us</h2>
                   <p style="text-align: center; color: #666; font-size: 14px;">We'd love to hear from you.</p>
                   
                   <div style="margin-top: 40px; text-align: center;">
                       <p style="margin-bottom: 5px;"><strong>📍 Visit</strong></p>
                       <p style="color: #555; font-size: 13px;">123 Innovation Drive<br>Tech Valley, CA 90210</p>
                       
                       <p style="margin-bottom: 5px; margin-top: 20px;"><strong>📞 Call</strong></p>
                       <p style="color: #555; font-size: 13px;">(800) 555-0199</p>
                       
                       <p style="margin-bottom: 5px; margin-top: 20px;"><strong>✉️ Email</strong></p>
                       <p style="color: #555; font-size: 13px;">hello@company.com</p>
                   </div>
                   
                   <div style="margin-top: 50px; text-align: center;">
                       <img src="https://via.placeholder.com/100x100?text=QR" alt="QR Code" style="width: 100px; height: 100px; opacity: 0.5;">
                   </div>
               </td>

               <!-- RIGHT PANEL (Front Cover) -->
               <td style="width: 33.33%; vertical-align: middle; background-color: #1e3a8a; color: white; text-align: center; padding: 40px;">
                   <div style="width: 80px; height: 80px; background: white; border-radius: 50%; margin: 0 auto 30px auto; display: flex; align-items: center; justify-content: center; color: #1e3a8a; font-weight: bold; font-size: 20px;">
                      LOGO
                   </div>
                   <h1 style="font-size: 36px; margin: 0 0 10px 0;">FUTURE<br>VISION</h1>
                   <p style="font-size: 14px; opacity: 0.8; letter-spacing: 1px; text-transform: uppercase;">Innovating Tomorrow</p>
                   
                   <div style="width: 50px; height: 2px; background: #60a5fa; margin: 30px auto;"></div>
                   
                   <p style="font-size: 16px; font-weight: bold;">2025 ANNUAL<br>REPORT</p>
               </td>
            </tr>
         </table>
      </div>
    `
  },
  {
    id: 'invoice',
    name: 'Professional Invoice',
    nameKey: 'templateInvoice',
    category: 'Business',
    categoryKey: 'templateCategoryBusiness',
    thumbnail: 'bg-slate-50 border border-slate-200',
    content: `
      <div style="font-family: 'Arial', sans-serif;">
        <table style="width: 100%; margin-bottom: 40px;">
          <tr>
            <td style="vertical-align: top;">
              <h1 style="margin: 0; color: #2b579a; font-size: 36px; letter-spacing: 2px;">INVOICE</h1>
              <p style="margin: 5px 0; color: #666; font-weight: bold;">#INV-2024-001</p>
            </td>
            <td style="text-align: right; vertical-align: top;">
              <h3 style="margin: 0; font-size: 18px;">Your Company Name</h3>
              <p style="margin: 0; color: #555; font-size: 13px;">123 Business Lane</p>
              <p style="margin: 0; color: #555; font-size: 13px;">City, State, Zip</p>
              <p style="margin: 0; color: #555; font-size: 13px;">contact@yourcompany.com</p>
            </td>
          </tr>
        </table>

        <table style="width: 100%; margin-bottom: 40px; background-color: #f8f9fa; border-radius: 4px;">
          <tr>
            <td style="width: 50%; padding: 20px;">
              <span style="color: #2b579a; font-size: 12px; text-transform: uppercase; font-weight: bold;">Bill To:</span><br>
              <strong style="font-size: 16px;">Client Name</strong><br>
              456 Client Street<br>
              Client City, ST 12345
            </td>
            <td style="width: 50%; padding: 20px; text-align: right;">
               <table style="float: right;">
                 <tr>
                    <td style="padding-right: 15px; color: #666;">Date:</td>
                    <td><strong>Oct 24, 2024</strong></td>
                 </tr>
                 <tr>
                    <td style="padding-right: 15px; color: #666;">Due:</td>
                    <td><strong>Nov 24, 2024</strong></td>
                 </tr>
               </table>
            </td>
          </tr>
        </table>

        <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
          <thead>
            <tr style="background-color: #2b579a; color: white;">
              <th style="padding: 12px 15px; text-align: left; width: 50%;">Description</th>
              <th style="padding: 12px 15px; text-align: right; width: 10%;">Qty</th>
              <th style="padding: 12px 15px; text-align: right; width: 20%;">Price</th>
              <th style="padding: 12px 15px; text-align: right; width: 20%;">Total</th>
            </tr>
          </thead>
          <tbody>
            <tr style="border-bottom: 1px solid #eee;">
              <td style="padding: 15px;">Web Design Services</td>
              <td style="padding: 15px; text-align: right;">10</td>
              <td style="padding: 15px; text-align: right;">$85.00</td>
              <td style="padding: 15px; text-align: right;">$850.00</td>
            </tr>
            <tr style="border-bottom: 1px solid #eee;">
              <td style="padding: 15px;">Hosting Setup</td>
              <td style="padding: 15px; text-align: right;">1</td>
              <td style="padding: 15px; text-align: right;">$150.00</td>
              <td style="padding: 15px; text-align: right;">$150.00</td>
            </tr>
            <tr style="border-bottom: 1px solid #eee;">
              <td style="padding: 15px;">Domain Registration (1 Year)</td>
              <td style="padding: 15px; text-align: right;">1</td>
              <td style="padding: 15px; text-align: right;">$20.00</td>
              <td style="padding: 15px; text-align: right;">$20.00</td>
            </tr>
          </tbody>
        </table>

        <div style="margin-left: auto; width: 40%;">
          <table style="width: 100%; border-collapse: collapse;">
             <tr>
                <td style="padding: 5px 0; color: #666;">Subtotal:</td>
                <td style="text-align: right; padding: 5px 0;">$1,020.00</td>
             </tr>
             <tr>
                <td style="padding: 5px 0; color: #666;">Tax (8%):</td>
                <td style="text-align: right; padding: 5px 0;">$81.60</td>
             </tr>
             <tr style="font-size: 18px; font-weight: bold; color: #2b579a;">
                <td style="padding: 15px 0; border-top: 2px solid #eee;">Total:</td>
                <td style="text-align: right; padding: 15px 0; border-top: 2px solid #eee;">$1,101.60</td>
             </tr>
          </table>
        </div>

        <div style="margin-top: 50px; padding-top: 20px; border-top: 1px solid #eee; font-size: 0.9em; color: #888; text-align: center;">
          <p>Payment is due within 30 days. Please make checks payable to Your Company Name.</p>
          <p style="font-weight: bold;">Thank you for your business!</p>
        </div>
      </div>
    `
  },
  {
    id: 'newsletter',
    name: 'Company Newsletter',
    nameKey: 'templateNewsletter',
    category: 'Marketing',
    categoryKey: 'templateCategoryMarketing',
    thumbnail: 'bg-green-50 border border-green-100',
    pageConfig: {
        size: 'A4',
        orientation: 'portrait',
        margins: 'none'
    },
    content: `
      <div style="font-family: 'Arial', sans-serif;">
        <div style="background-color: #27ae60; color: white; padding: 60px 40px; text-align: center;">
          <h1 style="margin: 0; font-size: 42px; letter-spacing: 4px; font-weight: bold;">THE MONTHLY ECO</h1>
          <div style="width: 50px; height: 4px; background-color: white; margin: 15px auto;"></div>
          <p style="margin: 15px 0 0 0; font-size: 14px; text-transform: uppercase; letter-spacing: 2px;">News from Green Earth Solutions</p>
        </div>
        
        <div style="padding: 40px;">
            <div style="padding: 15px; text-align: center; color: #666; border-bottom: 1px solid #eee; font-style: italic; font-size: 12px;">
            Vol. 12 • October 2025 • <a href="#" style="color: #27ae60; text-decoration: none;">www.greenearth.com</a>
            </div>

            <div style="margin: 30px 0; padding: 0 10px;">
            <h2 style="color: #2c3e50; font-size: 24px; margin-bottom: 15px;">We've Gone Carbon Neutral!</h2>
            <p style="font-size: 16px; line-height: 1.6; color: #444;">
                We are thrilled to announce that as of this month, Green Earth Solutions has achieved complete carbon neutrality across all our operations. This milestone represents five years of dedicated effort to reduce emissions and invest in renewable energy projects.
            </p>
            </div>

            <table style="width: 100%; border-collapse: collapse; margin-top: 30px;">
            <tr>
                <td style="width: 50%; vertical-align: top; padding: 20px; background-color: #f9f9f9; border-right: 5px solid white;">
                <h3 style="color: #27ae60; margin-top: 0; border-bottom: 2px solid #ddd; padding-bottom: 10px;">Upcoming Events</h3>
                <ul style="padding-left: 20px; line-height: 1.8; color: #555;">
                    <li style="margin-bottom: 10px;"><strong>Nov 5:</strong> Community Garden Day</li>
                    <li style="margin-bottom: 10px;"><strong>Nov 12:</strong> Sustainability Workshop</li>
                    <li style="margin-bottom: 10px;"><strong>Nov 20:</strong> Annual Fundraiser Gala</li>
                </ul>
                </td>
                <td style="width: 50%; vertical-align: top; padding: 20px; background-color: #f9f9f9;">
                <h3 style="color: #27ae60; margin-top: 0; border-bottom: 2px solid #ddd; padding-bottom: 10px;">Employee Spotlight</h3>
                <p style="font-weight: bold; margin-bottom: 5px; color: #333;">Sarah Chen</p>
                <p style="color: #666; font-size: 12px; margin-top: 0; margin-bottom: 10px;"><i>Head of Research</i></p>
                <p style="font-size: 13px; color: #555; line-height: 1.5;">Sarah recently published a paper on sustainable packaging that has been cited by industry leaders worldwide.</p>
                </td>
            </tr>
            </table>
            
            <div style="background-color: #f1f8e9; padding: 20px; margin-top: 30px; border-radius: 8px; text-align: center; border: 1px solid #c8e6c9;">
            <h3 style="margin-top: 0; color: #2e7d32; font-size: 18px;">Tip of the Month</h3>
            <p style="margin-bottom: 0; color: #444;">Switching to LED bulbs can save up to 80% energy compared to traditional incandescents.</p>
            </div>
        </div>
      </div>
    `
  },
  {
    id: 'meeting-notes',
    name: 'Meeting Minutes',
    nameKey: 'templateMeetingMinutes',
    category: 'Business',
    categoryKey: 'templateCategoryBusiness',
    thumbnail: 'bg-yellow-50 border border-yellow-100',
    content: `
      <div style="font-family: 'Arial', sans-serif;">
        <h1 style="color: #d97706; border-bottom: 4px solid #d97706; padding-bottom: 10px; font-size: 28px;">MEETING MINUTES</h1>
        
        <table style="width: 100%; margin-top: 20px; background-color: #fffbeb; border: 1px solid #fcd34d; border-collapse: collapse;">
          <tr>
            <td style="padding: 12px; border: 1px solid #fcd34d;"><strong>Date:</strong> October 24, 2025</td>
            <td style="padding: 12px; border: 1px solid #fcd34d;"><strong>Time:</strong> 10:00 AM - 11:30 AM</td>
          </tr>
          <tr>
            <td style="padding: 12px; border: 1px solid #fcd34d;" colspan="2"><strong>Location:</strong> Conference Room B / Zoom</td>
          </tr>
          <tr>
            <td style="padding: 12px; border: 1px solid #fcd34d;" colspan="2"><strong>Attendees:</strong> John Doe, Jane Smith, Robert Johnson, Emily Davis</td>
          </tr>
        </table>

        <h3 style="background-color: #f3f4f6; padding: 8px 12px; border-left: 5px solid #6b7280; margin-top: 30px; color: #374151;">1. Agenda Items</h3>
        <ol style="color: #4b5563; line-height: 1.6;">
          <li>Q3 Performance Review</li>
          <li>Budget Allocation for Q4</li>
          <li>New Hire Onboarding Process</li>
        </ol>

        <h3 style="background-color: #f3f4f6; padding: 8px 12px; border-left: 5px solid #6b7280; margin-top: 25px; color: #374151;">2. Discussion Summary</h3>
        <div style="padding-left: 10px;">
          <p style="margin-bottom: 15px;"><strong style="color: #111;">Q3 Performance:</strong> The team exceeded sales targets by 15%. Marketing attributed this to the new summer campaign.</p>
          <p style="margin-bottom: 15px;"><strong style="color: #111;">Budget Q4:</strong> Finance requested all department heads to submit revised estimates by Friday.</p>
        </div>
        
        <h3 style="background-color: #f3f4f6; padding: 8px 12px; border-left: 5px solid #6b7280; margin-top: 25px; color: #374151;">3. Action Items</h3>
        <table style="width: 100%; border-collapse: collapse; margin-top: 15px;">
          <thead>
            <tr style="border-bottom: 2px solid #ddd; background-color: #f9fafb;">
              <th style="text-align: left; padding: 10px; color: #374151;">Task</th>
              <th style="text-align: left; padding: 10px; color: #374151;">Owner</th>
              <th style="text-align: left; padding: 10px; color: #374151;">Due Date</th>
            </tr>
          </thead>
          <tbody>
            <tr style="border-bottom: 1px solid #eee;">
              <td style="padding: 10px; color: #4b5563;">Submit Q4 Budget</td>
              <td style="padding: 10px; color: #4b5563;">Dept Heads</td>
              <td style="padding: 10px; color: #4b5563;">Oct 27</td>
            </tr>
            <tr style="border-bottom: 1px solid #eee;">
              <td style="padding: 10px; color: #4b5563;">Draft New Onboarding Guide</td>
              <td style="padding: 10px; color: #4b5563;">HR Team</td>
              <td style="padding: 10px; color: #4b5563;">Nov 10</td>
            </tr>
          </tbody>
        </table>

        <div style="margin-top: 40px; font-size: 12px; color: #9ca3af; border-top: 1px solid #eee; padding-top: 10px;">
          Minutes submitted by: John Doe <br>
          Approved by: Robert Johnson
        </div>
      </div>
    `
  },
  {
    id: 'business-proposal',
    name: 'Business Proposal',
    nameKey: 'templateBusinessProposal',
    category: 'Business',
    categoryKey: 'templateCategoryBusiness',
    thumbnail: 'bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200',
    content: `
      <div style="font-family: 'Arial', sans-serif; color: #1f2937;">
        <!-- Cover Page -->
        <div style="text-align: center; padding: 80px 0;">
          <h1 style="font-size: 36pt; font-weight: bold; color: #1e40af; margin-bottom: 30px;">BUSINESS PROPOSAL</h1>
          <h2 style="font-size: 24pt; color: #3b82f6; margin-bottom: 50px;">CloudWord: Next-Generation Document Editing Platform</h2>

          <div style="margin: 60px 0;">
            <p style="font-size: 14pt; margin-bottom: 10px;"><strong>Prepared for:</strong></p>
            <p style="font-size: 12pt; margin-bottom: 30px;">TechVentures Capital</p>

            <p style="font-size: 14pt; margin-bottom: 10px;"><strong>Prepared by:</strong></p>
            <p style="font-size: 12pt; margin-bottom: 5px;">Penko Technologies, Inc.</p>
            <p style="font-size: 12pt;">Jane Doe, CEO</p>
          </div>

          <p style="font-size: 12pt; margin-top: 80px;">December 25, 2025</p>
        </div>

        <div style="page-break-before: always; height: 1px;"></div>

        <!-- Executive Summary -->
        <h2 style="color: #1e40af; border-bottom: 3px solid #3b82f6; padding-bottom: 10px; margin-top: 30px;">EXECUTIVE SUMMARY</h2>

        <p style="line-height: 1.8; margin-bottom: 15px;">This proposal outlines a strategic investment opportunity in CloudWord, a revolutionary document editing platform that combines offline-first capabilities with advanced AI features. We are seeking $2.5 million in Series A funding to accelerate product development, expand our user base, and establish market leadership in the professional writing software sector.</p>

        <p style="line-height: 1.8; margin-bottom: 15px;"><strong>Key Highlights:</strong></p>
        <ul style="line-height: 1.8; margin-left: 30px; margin-bottom: 20px;">
          <li>15,000+ active users with 40% month-over-month growth</li>
          <li>Industry-leading features including screenplay formatting, LaTeX math, and Markdown support</li>
          <li>Projected $5M ARR within 24 months</li>
          <li>Clear path to profitability by Q4 2026</li>
        </ul>

        <!-- Problem Statement -->
        <h2 style="color: #1e40af; border-bottom: 3px solid #3b82f6; padding-bottom: 10px; margin-top: 40px;">PROBLEM STATEMENT</h2>

        <p style="line-height: 1.8; margin-bottom: 15px;">Current document editing solutions suffer from critical limitations that frustrate professional users:</p>

        <div style="background-color: #eff6ff; padding: 20px; border-left: 4px solid #3b82f6; margin: 20px 0;">
          <p style="margin-bottom: 10px;"><strong>1. Cloud Dependency</strong> - Existing platforms require constant internet connectivity, limiting productivity during travel or in areas with poor connectivity.</p>
          <p style="margin-bottom: 10px;"><strong>2. Limited Specialized Features</strong> - Academic writers, screenwriters, and technical authors lack proper formatting tools for their specific needs.</p>
          <p style="margin-bottom: 10px;"><strong>3. Poor Privacy</strong> - Cloud-based solutions raise concerns about data security and intellectual property protection.</p>
          <p><strong>4. Subpar User Experience</strong> - Bloated interfaces and slow performance plague traditional word processors.</p>
        </div>

        <!-- Proposed Solution -->
        <h2 style="color: #1e40af; border-bottom: 3px solid #3b82f6; padding-bottom: 10px; margin-top: 40px;">PROPOSED SOLUTION</h2>

        <p style="line-height: 1.8; margin-bottom: 15px;">CloudWord addresses these pain points through innovative technology and user-centric design:</p>

        <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
          <tr style="background-color: #dbeafe;">
            <th style="padding: 15px; text-align: left; border: 1px solid #93c5fd;">Feature</th>
            <th style="padding: 15px; text-align: left; border: 1px solid #93c5fd;">Benefit</th>
          </tr>
          <tr>
            <td style="padding: 12px; border: 1px solid #e5e7eb;"><strong>Offline-First Architecture</strong></td>
            <td style="padding: 12px; border: 1px solid #e5e7eb;">Work anywhere without internet dependency; automatic cloud sync when online</td>
          </tr>
          <tr style="background-color: #f9fafb;">
            <td style="padding: 12px; border: 1px solid #e5e7eb;"><strong>Specialized Templates</strong></td>
            <td style="padding: 12px; border: 1px solid #e5e7eb;">Industry-standard formats for screenplays, academic papers (APA, MLA, IEEE), and technical documentation</td>
          </tr>
          <tr>
            <td style="padding: 12px; border: 1px solid #e5e7eb;"><strong>Advanced Math & Code Support</strong></td>
            <td style="padding: 12px; border: 1px solid #e5e7eb;">Built-in LaTeX rendering and syntax highlighting for 18+ programming languages</td>
          </tr>
          <tr style="background-color: #f9fafb;">
            <td style="padding: 12px; border: 1px solid #e5e7eb;"><strong>Lightning-Fast Performance</strong></td>
            <td style="padding: 12px; border: 1px solid #e5e7eb;">Modern web technologies deliver instant load times and smooth editing experience</td>
          </tr>
        </table>

        <!-- Market Opportunity -->
        <h2 style="color: #1e40af; border-bottom: 3px solid #3b82f6; padding-bottom: 10px; margin-top: 40px;">MARKET OPPORTUNITY</h2>

        <p style="line-height: 1.8; margin-bottom: 15px;">The global document editing software market represents a $25 billion opportunity, with strong growth drivers:</p>

        <ul style="line-height: 1.8; margin-left: 30px; margin-bottom: 20px;">
          <li><strong>Remote Work Proliferation:</strong> 58% of knowledge workers now work remotely at least part-time</li>
          <li><strong>Academic Market Growth:</strong> 23 million college students globally need specialized writing tools</li>
          <li><strong>Content Creator Economy:</strong> 50+ million independent creators require professional formatting capabilities</li>
        </ul>

        <!-- Financial Projections -->
        <h2 style="color: #1e40af; border-bottom: 3px solid #3b82f6; padding-bottom: 10px; margin-top: 40px;">FINANCIAL PROJECTIONS</h2>

        <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
          <tr style="background-color: #1e40af; color: white;">
            <th style="padding: 15px; text-align: left;">Metric</th>
            <th style="padding: 15px; text-align: right;">Year 1</th>
            <th style="padding: 15px; text-align: right;">Year 2</th>
            <th style="padding: 15px; text-align: right;">Year 3</th>
          </tr>
          <tr>
            <td style="padding: 12px; border: 1px solid #e5e7eb;">Users</td>
            <td style="padding: 12px; border: 1px solid #e5e7eb; text-align: right;">50,000</td>
            <td style="padding: 12px; border: 1px solid #e5e7eb; text-align: right;">200,000</td>
            <td style="padding: 12px; border: 1px solid #e5e7eb; text-align: right;">750,000</td>
          </tr>
          <tr style="background-color: #f9fafb;">
            <td style="padding: 12px; border: 1px solid #e5e7eb;">Revenue</td>
            <td style="padding: 12px; border: 1px solid #e5e7eb; text-align: right;">$800K</td>
            <td style="padding: 12px; border: 1px solid #e5e7eb; text-align: right;">$5.2M</td>
            <td style="padding: 12px; border: 1px solid #e5e7eb; text-align: right;">$18.5M</td>
          </tr>
          <tr>
            <td style="padding: 12px; border: 1px solid #e5e7eb;">Gross Margin</td>
            <td style="padding: 12px; border: 1px solid #e5e7eb; text-align: right;">72%</td>
            <td style="padding: 12px; border: 1px solid #e5e7eb; text-align: right;">78%</td>
            <td style="padding: 12px; border: 1px solid #e5e7eb; text-align: right;">82%</td>
          </tr>
        </table>

        <!-- Investment Ask -->
        <h2 style="color: #1e40af; border-bottom: 3px solid #3b82f6; padding-bottom: 10px; margin-top: 40px;">INVESTMENT ASK</h2>

        <div style="background-color: #dbeafe; padding: 25px; border-radius: 8px; margin: 20px 0;">
          <p style="font-size: 16pt; font-weight: bold; margin-bottom: 15px;">We are seeking $2,500,000 in Series A funding</p>

          <p style="line-height: 1.8; margin-bottom: 10px;"><strong>Fund Allocation:</strong></p>
          <ul style="line-height: 1.8; margin-left: 30px;">
            <li>Product Development: $1,200,000 (48%)</li>
            <li>Sales & Marketing: $800,000 (32%)</li>
            <li>Operations & Infrastructure: $300,000 (12%)</li>
            <li>Working Capital: $200,000 (8%)</li>
          </ul>
        </div>

        <!-- Call to Action -->
        <h2 style="color: #1e40af; border-bottom: 3px solid #3b82f6; padding-bottom: 10px; margin-top: 40px;">NEXT STEPS</h2>

        <p style="line-height: 1.8; margin-bottom: 15px;">We welcome the opportunity to discuss this proposal in detail and answer any questions you may have. Our team is prepared to provide additional financial documentation, product demonstrations, and customer references upon request.</p>

        <p style="line-height: 1.8; margin-bottom: 20px;">Please contact us at your earliest convenience to schedule a meeting:</p>

        <div style="background-color: #f3f4f6; padding: 20px; margin: 20px 0;">
          <p style="margin-bottom: 5px;"><strong>Jane Doe</strong>, Chief Executive Officer</p>
          <p style="margin-bottom: 5px;">Email: jane.doe@cloudword.com</p>
          <p style="margin-bottom: 5px;">Phone: (555) 123-4567</p>
          <p>Website: www.cloudword.com</p>
        </div>

        <p style="text-align: center; margin-top: 50px; font-style: italic; color: #6b7280;">Thank you for considering this investment opportunity.</p>
      </div>
    `
  },
  {
    id: 'screenplay',
    name: 'Screenplay',
    nameKey: 'templateScreenplay',
    category: 'Creative',
    categoryKey: 'templateCategoryCreative',
    thumbnail: 'bg-gradient-to-br from-purple-900 via-indigo-800 to-blue-900 border-none ring-2 ring-purple-300',
    isScreenplay: true,
    pageConfig: {
      size: 'Letter',
      orientation: 'portrait',
      margins: 'none'
    },
    content: `
      <div style="font-family: 'Courier', 'Courier New', monospace; font-size: 12pt; line-height: 1.5; padding: 1in 1in 1in 1.5in;">
        <div style="text-align: center; margin-bottom: 200px; margin-top: 100px;">
          <h1 style="font-family: 'Courier', 'Courier New', monospace; font-size: 14pt; font-weight: normal; text-transform: uppercase; margin-bottom: 40px;">UNTITLED SCREENPLAY</h1>
          <p style="margin: 5px 0;">by</p>
          <p style="margin: 5px 0; font-weight: bold;">YOUR NAME</p>
          <div style="margin-top: 120px; font-size: 10pt;">
            <p>Draft Date: ${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</p>
          </div>
        </div>

        <div style="page-break-before: always;"></div>

        <p class="screenplay-scene-heading" data-screenplay-type="scene-heading" style="text-transform: uppercase; font-weight: bold; margin-top: 24px; margin-bottom: 12px;">INT. COFFEE SHOP - DAY</p>

        <p class="screenplay-action" data-screenplay-type="action" style="margin-bottom: 12px;">A cozy neighborhood coffee shop. Warm lighting, soft jazz playing. SARAH (30s, determined, creative) sits at a corner table with her laptop, typing furiously.</p>

        <p class="screenplay-action" data-screenplay-type="action" style="margin-bottom: 12px;">The door CHIMES. MIKE (30s, charming, slightly disheveled) enters, scanning the room.</p>

        <p class="screenplay-character" data-screenplay-type="character" style="text-transform: uppercase; margin-left: 3.7in; margin-top: 12px; margin-bottom: 0;">MIKE</p>

        <p class="screenplay-dialogue" data-screenplay-type="dialogue" style="margin-left: 2.5in; max-width: 3.5in; margin-bottom: 12px;">Sarah? Is that you?</p>

        <p class="screenplay-action" data-screenplay-type="action" style="margin-bottom: 12px;">Sarah looks up, surprised. A flicker of recognition crosses her face.</p>

        <p class="screenplay-character" data-screenplay-type="character" style="text-transform: uppercase; margin-left: 3.7in; margin-top: 12px; margin-bottom: 0;">SARAH</p>

        <p class="screenplay-parenthetical" data-screenplay-type="parenthetical" style="margin-left: 3.1in; margin-bottom: 0;">(cautiously)</p>

        <p class="screenplay-dialogue" data-screenplay-type="dialogue" style="margin-left: 2.5in; max-width: 3.5in; margin-bottom: 12px;">Mike? What are you doing here?</p>

        <p class="screenplay-character" data-screenplay-type="character" style="text-transform: uppercase; margin-left: 3.7in; margin-top: 12px; margin-bottom: 0;">MIKE</p>

        <p class="screenplay-parenthetical" data-screenplay-type="parenthetical" style="margin-left: 3.1in; margin-bottom: 0;">(grinning)</p>

        <p class="screenplay-dialogue" data-screenplay-type="dialogue" style="margin-left: 2.5in; max-width: 3.5in; margin-bottom: 12px;">I could ask you the same thing. It's been what, five years?</p>

        <p class="screenplay-action" data-screenplay-type="action" style="margin-bottom: 12px;">An awkward beat. Sarah closes her laptop.</p>

        <p class="screenplay-character" data-screenplay-type="character" style="text-transform: uppercase; margin-left: 3.7in; margin-top: 12px; margin-bottom: 0;">SARAH</p>

        <p class="screenplay-dialogue" data-screenplay-type="dialogue" style="margin-left: 2.5in; max-width: 3.5in; margin-bottom: 12px;">Six, actually.</p>

        <p class="screenplay-transition" data-screenplay-type="transition" style="text-transform: uppercase; text-align: right; margin-top: 12px; margin-bottom: 12px;">FADE TO:</p>

        <p class="screenplay-scene-heading" data-screenplay-type="scene-heading" style="text-transform: uppercase; font-weight: bold; margin-top: 24px; margin-bottom: 12px;">INT. COFFEE SHOP - LATER</p>

        <p class="screenplay-action" data-screenplay-type="action" style="margin-bottom: 12px;">Sarah and Mike sit across from each other, coffee cups between them. The tension has eased slightly.</p>

        <p style="margin-top: 60px; text-align: center; font-style: italic; color: #666; font-size: 10pt;">[Continue your screenplay here...]</p>

        <div style="margin-top: 80px; padding-top: 20px; border-top: 1px solid #ccc; font-size: 10pt; color: #666;">
          <p><strong>Screenplay Tips:</strong></p>
          <ul style="list-style: none; padding-left: 0; line-height: 1.8;">
            <li>• Press TAB to cycle through element types (Scene → Action → Character → Dialogue)</li>
            <li>• Type "INT." or "EXT." to auto-format as Scene Heading</li>
            <li>• All caps text becomes Character name</li>
            <li>• Text in (parentheses) after Character becomes Parenthetical direction</li>
            <li>• One page ≈ One minute of screen time</li>
            <li>• Export to PDF with industry-standard formatting</li>
          </ul>
        </div>
      </div>
    `
  },
  {
    id: 'novel-manuscript',
    name: 'Novel Manuscript',
    nameKey: 'templateNovelManuscript',
    category: 'Creative',
    categoryKey: 'templateCategoryCreative',
    thumbnail: 'bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-200',
    content: `
      <div style="line-height: 2.0; font-family: 'Times New Roman', serif; font-size: 12pt; color: #000;">
        <div style="text-align: left; margin-bottom: 100px;">
          <p>Jane A. Doe</p>
          <p>123 Writer's Lane</p>
          <p>New York, NY 10001</p>
          <p>(555) 123-4567</p>
          <p>jane@example.com</p>
        </div>

        <div style="text-align: right; margin-bottom: 50px;">
          <p>Approximately 80,000 words</p>
        </div>

        <div style="text-align: center; margin: 150px 0;">
          <h1 style="font-size: 18pt; font-weight: bold; text-transform: uppercase;">The Last Library</h1>
          <p style="margin-top: 40px;">by</p>
          <p style="margin-top: 10px; font-size: 14pt;">Jane A. Doe</p>
        </div>

        <div style="page-break-before: always; height: 1px; margin: 20px 0;"></div>

        <!-- Chapter 1 -->
        <div style="text-align: center; margin: 100px 0 50px 0;">
          <h2 style="font-weight: bold;">Chapter One</h2>
        </div>

        <p style="text-indent: 0.5in; margin-bottom: 0;">The last book in the world sat on a shelf that hadn't been dusted in thirty years. Sarah knew this because she had been counting—not the dust particles, though there were plenty, but the years since anyone had bothered to care. Thirty years since the Great Digitization, when humanity decided that paper was obsolete, that the smell of old books was just nostalgia talking, that progress meant leaving certain things behind.</p>

        <p style="text-indent: 0.5in; margin-bottom: 0; margin-top: 0;">She ran her fingers along the spine, feeling the cracked leather beneath her fingertips. <em>The Complete Works of Shakespeare</em>, the gold lettering read, though most of the gold had flaked away long ago. It was fitting, she thought, that Shakespeare would be the last one standing. He'd probably have written a sonnet about it.</p>

        <p style="text-indent: 0.5in; margin-bottom: 0; margin-top: 0;">"You know you're not supposed to be in here," a voice said from the doorway. Marcus, of course. The only other person who knew about this place, who understood why she kept coming back.</p>

        <p style="text-indent: 0.5in; margin-bottom: 0; margin-top: 0;">"I know," Sarah replied, not turning around. "But someone has to remember."</p>

        <p style="text-indent: 0.5in; margin-bottom: 0; margin-top: 0;">The library—if you could still call it that—occupied the basement of what used to be the New York Public Library. Now the building above served as a data center, humming with servers that stored every book ever written in neat, searchable, instantly accessible digital format. Progress, they called it. Sarah had other words for it.</p>

        <p style="text-indent: 0.5in; margin-bottom: 0; margin-top: 0;">Marcus crossed the room, his footsteps echoing in the vast, empty space. "They're going to demolish this section next week. Corporate wants to expand the server farm."</p>

        <p style="text-indent: 0.5in; margin-bottom: 0; margin-top: 0;">"Of course they do." Sarah carefully pulled the Shakespeare volume from its shelf, cradling it like a newborn. "What's one more room of history when you can have more processing power?"</p>

        <p style="text-indent: 0.5in; margin-bottom: 0; margin-top: 0;">"Sarah—"</p>

        <p style="text-indent: 0.5in; margin-bottom: 0; margin-top: 0;">"Don't." She held up a hand. "Don't tell me to let it go. Don't tell me it's just a book. Don't tell me the words are all that matter and they're safely preserved in the cloud."</p>

        <p style="text-indent: 0.5in; margin-bottom: 0; margin-top: 0;">He fell silent, because they'd had this argument before, and he knew she was right. The words weren't all that mattered. The weight of the book in your hands mattered. The smell of aging paper mattered. The way pages whispered when you turned them mattered. The slight variations in printing, the marginalia from previous readers, the coffee stains and dog-eared corners—all of it mattered, all of it was part of the story that no digital file could ever capture.</p>

        <p style="text-indent: 0.5in; margin-bottom: 0; margin-top: 0;">"So what are you going to do?" Marcus asked quietly.</p>

        <p style="text-indent: 0.5in; margin-bottom: 0; margin-top: 0;">Sarah looked at the book in her hands, then at the empty shelves stretching into the darkness. A plan was forming in her mind, audacious and probably impossible, but then again, thirty years ago, people would have said it was impossible that the world would forget the value of a physical book.</p>

        <p style="text-indent: 0.5in; margin-bottom: 0; margin-top: 0;">"I'm going to save it," she said. "All of it. Every last word, every last page. And I'm going to remind people why it matters."</p>

        <p style="text-indent: 0.5in; margin-bottom: 0; margin-top: 0;">Marcus laughed, but it wasn't unkind. "You're going to save the world's last library all by yourself?"</p>

        <p style="text-indent: 0.5in; margin-bottom: 0; margin-top: 0;">She turned to face him, and he saw the fire in her eyes that he'd first fallen in love with twenty years ago. "No," Sarah said. "Not by myself. But I'm going to start."</p>

        <p style="text-indent: 0.5in; margin-bottom: 0; margin-top: 0;">And that was how it began—the revolution that would change everything, started by one woman, one book, and the stubborn belief that some things are too important to let fade into history.</p>

        <div style="text-align: center; margin: 50px 0;">
          <p>*</p>
        </div>

        <p style="text-indent: 0.5in; margin-bottom: 0;">The next morning, Sarah stood outside the shuttered bookstore on 42nd Street, the one that had closed fifteen years ago when the last book retailer went bankrupt. The windows were boarded up, the sign faded and cracked, but the building was still structurally sound. She'd checked.</p>
      </div>
    `
  },
  {
    id: 'short-story',
    name: 'Short Story',
    nameKey: 'templateShortStory',
    category: 'Creative',
    categoryKey: 'templateCategoryCreative',
    thumbnail: 'bg-gradient-to-br from-rose-50 to-pink-50 border border-rose-200',
    content: `
      <div style="line-height: 1.8; font-family: 'Georgia', serif; font-size: 12pt; color: #000; max-width: 6.5in; margin: 0 auto;">
        <h1 style="text-align: center; font-size: 16pt; font-weight: bold; margin-bottom: 40px;">The Clockmaker's Daughter</h1>

        <p style="text-indent: 0.5in; margin-bottom: 15px;">The last clock in the shop stopped at 3:47 AM on a Tuesday, and Eliza knew her father was dead.</p>

        <p style="text-indent: 0.5in; margin-bottom: 15px;">Not from any supernatural connection or mystical bond, but because she'd heard him tell her mother, drunk on anniversary wine, that when he died, all the clocks would stop. He'd synchronized them, he said, to his heartbeat—a feat of engineering that her mother had dismissed as romantic nonsense and Eliza had filed away as yet another of her father's impossible claims.</p>

        <p style="text-indent: 0.5in; margin-bottom: 15px;">But there she stood in the workshop, surrounded by sixty-three silent timepieces, each frozen at 3:47, and her phone showed a message from the hospital timestamped 3:51 AM.</p>

        <p style="text-indent: 0.5in; margin-bottom: 15px;">She should have been crying, probably. Should have called her mother back, rushed to the hospital, done any of the things that grief demanded. Instead, Eliza found herself examining the closest clock—a brass pocket watch from 1887—and wondering how he'd done it.</p>

        <p style="text-indent: 0.5in; margin-bottom: 15px;">Her father had been a man of secrets. Not the painful kind, not affairs or hidden debts, but the gentle secrets of a craftsman who believed that some magic should remain unexplained. He'd never taught her his techniques, despite her begging. "When you're ready," he'd always said, "the clocks will teach you themselves."</p>

        <p style="text-indent: 0.5in; margin-bottom: 15px;">Well, she was ready now. Ready or not, the shop was hers, along with its inventory of antique timepieces, custom repairs, and apparently, impossible engineering.</p>

        <p style="text-indent: 0.5in; margin-bottom: 15px;">Eliza picked up the pocket watch, feeling its weight in her palm. On impulse, she opened the back casing—something her father had always forbidden—and found not the expected gears and springs, but a single hand-written note, perfectly folded to fit the space.</p>

        <p style="text-indent: 0.5in; margin-bottom: 15px; font-style: italic;">"My dear Eliza, If you're reading this, then I've run out of time (a clockmaker's joke—sorry, I couldn't resist). The synchronization isn't mechanical; it's intentional. Every clock, every repair, every adjustment I made, I made thinking of you. When the heart stops caring, the hands stop moving. Keep caring, keep creating, and time will always be on your side. Love, Dad. P.S. Check the grandfather clock in the corner."</p>

        <p style="text-indent: 0.5in; margin-bottom: 15px;">Through tears she hadn't realized were falling, Eliza crossed to the massive grandfather clock that had stood in the corner since before she was born. Its pendulum hung still, its face frozen at 3:47 like all the others.</p>

        <p style="text-indent: 0.5in; margin-bottom: 15px;">But when she opened its case, she found not another note but a gear—golden, warm to the touch, with her name engraved along its edge. And suddenly she understood. Her father hadn't synchronized the clocks to his heartbeat. He'd synchronized them to hers.</p>

        <p style="text-indent: 0.5in; margin-bottom: 15px;">The moment she lifted the gear, every clock in the shop chimed once, and then, one by one, they began to tick again. Not at 3:47, but at the current time: 4:15 AM.</p>

        <p style="text-indent: 0.5in; margin-bottom: 15px;">Time, her father had tried to tell her, wasn't about gears and springs. It was about continuation, about passing things forward, about the moments that mattered enough to measure.</p>

        <p style="text-indent: 0.5in; margin-bottom: 15px;">Eliza held the golden gear up to the light, watching it catch the dawn breaking through the workshop windows. She had a shop to run, clocks to repair, and a legacy to continue. The secret, it turned out, was that there was no secret—just love, translated into the language of ticking hands and spinning gears.</p>

        <p style="text-indent: 0.5in; margin-bottom: 15px;">She placed the gear in her pocket and reached for her phone. Time to call her mother. Time to move forward. Time to begin.</p>

        <div style="text-align: center; margin: 40px 0; font-size: 14pt;">
          <p>— END —</p>
        </div>
      </div>
    `
  },
  {
    id: 'poetry-collection',
    name: 'Poetry Collection',
    nameKey: 'templatePoetryCollection',
    category: 'Creative',
    categoryKey: 'templateCategoryCreative',
    thumbnail: 'bg-gradient-to-br from-violet-50 to-purple-50 border border-violet-200',
    content: `
      <div style="font-family: 'Georgia', serif; font-size: 11pt; color: #000; max-width: 5in; margin: 0 auto;">
        <div style="text-align: center; margin: 80px 0;">
          <h1 style="font-size: 24pt; font-weight: bold; margin-bottom: 20px;">Echoes in Digital Silence</h1>
          <p style="font-size: 14pt; font-style: italic;">Poetry by Jane Doe</p>
        </div>

        <div style="page-break-before: always; height: 1px;"></div>

        <!-- Poem 1 -->
        <h3 style="text-align: center; font-weight: bold; margin: 50px 0 30px 0;">I. The Last Typewriter</h3>

        <div style="line-height: 1.8; text-align: center;">
          <p>In the basement of forgotten things,<br/>
          where dust motes dance in slanted light,<br/>
          a typewriter waits, its ribbon dry,<br/>
          its keys like teeth in a silent mouth.</p>

          <p style="margin-top: 20px;">Once it sang symphonies of thought—<br/>
          <em>click-clack-ding</em>, the rhythm of creation,<br/>
          each letter stamped with force and purpose,<br/>
          permanent as promises carved in stone.</p>

          <p style="margin-top: 20px;">Now pixels dance across glass screens,<br/>
          words appear and disappear like ghosts,<br/>
          deleted without trace, edited without scar,<br/>
          perfect and empty as polished mirrors.</p>

          <p style="margin-top: 20px;">But the typewriter remembers<br/>
          when mistakes were human,<br/>
          when X's crossed out errors,<br/>
          when truth wore the marks of its making.</p>
        </div>

        <!-- Poem 2 -->
        <h3 style="text-align: center; font-weight: bold; margin: 80px 0 30px 0;">II. Bandwidth</h3>

        <div style="line-height: 1.8; text-align: center;">
          <p>We stream ourselves into the void—<br/>
          high-definition loneliness,<br/>
          buffering between heartbeats,<br/>
          connection bars full but empty.</p>

          <p style="margin-top: 20px;">A thousand friends, and yet<br/>
          who knows the sound of my laughter?<br/>
          Who sees the way I fold my hands<br/>
          when words won't come?</p>

          <p style="margin-top: 20px;">We trade presence for proximity,<br/>
          sacrifice depth for reach,<br/>
          broadcast signals into space<br/>
          and call it conversation.</p>

          <p style="margin-top: 20px;">But bandwidth can't transmit<br/>
          the weight of a hand on a shoulder,<br/>
          the warmth of shared silence,<br/>
          the unspoken understanding in a glance.</p>

          <p style="margin-top: 20px;">Some things, I'm learning,<br/>
          require the full spectrum<br/>
          of human wavelengths—<br/>
          analog, imperfect, irreplaceable.</p>
        </div>

        <!-- Poem 3 -->
        <h3 style="text-align: center; font-weight: bold; margin: 80px 0 30px 0;">III. Delete Key</h3>

        <div style="line-height: 1.8; text-align: left; padding-left: 1in;">
          <p>How easy it is to erase—<br/>
          &nbsp;&nbsp;&nbsp;&nbsp;a single key, barely touched,<br/>
          &nbsp;&nbsp;&nbsp;&nbsp;and words vanish like they never existed.</p>

          <p style="margin-top: 20px;">I miss the archaeology of drafts,<br/>
          &nbsp;&nbsp;&nbsp;&nbsp;the crossed-out lines revealing thought,<br/>
          &nbsp;&nbsp;&nbsp;&nbsp;the journey from mind to page laid bare.</p>

          <p style="margin-top: 20px;">Now we revise in secret,<br/>
          &nbsp;&nbsp;&nbsp;&nbsp;presenting only polished surfaces,<br/>
          &nbsp;&nbsp;&nbsp;&nbsp;hiding the beautiful mess of becoming.</p>

          <p style="margin-top: 20px;">But scars tell stories deletion can't—<br/>
          &nbsp;&nbsp;&nbsp;&nbsp;of struggle, of growth,<br/>
          &nbsp;&nbsp;&nbsp;&nbsp;of the courage to be imperfect<br/>
          &nbsp;&nbsp;&nbsp;&nbsp;in a world demanding perfection.</p>
        </div>

        <!-- Poem 4 -->
        <h3 style="text-align: center; font-weight: bold; margin: 80px 0 30px 0;">IV. Offline</h3>

        <div style="line-height: 1.8; text-align: center;">
          <p><em>Sometimes I dream of disconnection—</em></p>

          <p style="margin-top: 20px;">Not the panic of lost signal,<br/>
          but chosen silence,<br/>
          deliberate absence,<br/>
          the radical act of being unreachable.</p>

          <p style="margin-top: 20px;">To exist in the spaces between pings,<br/>
          to think thoughts that don't become posts,<br/>
          to experience moments<br/>
          without documenting their existence.</p>

          <p style="margin-top: 20px;">What would I discover<br/>
          in that vast, quiet country<br/>
          beyond the reach of Wi-Fi?<br/>
          Who would I become<br/>
          without the constant mirror<br/>
          of others' watching eyes?</p>

          <p style="margin-top: 20px;">Perhaps I'd remember<br/>
          that I existed before I was online,<br/>
          that presence precedes profile,<br/>
          that being comes before broadcast.</p>

          <p style="margin-top: 20px;"><em>Perhaps I'd find myself again,<br/>
          in the silence between signals.</em></p>
        </div>

        <!-- Poem 5 -->
        <h3 style="text-align: center; font-weight: bold; margin: 80px 0 30px 0;">V. Save File</h3>

        <div style="line-height: 1.8; text-align: center;">
          <p>What do we save<br/>
          in this age of infinite storage?<br/>
          Every photo, every email,<br/>
          every draft and deletion—</p>

          <p style="margin-top: 20px;">As if memory could be outsourced,<br/>
          as if hard drives could hold<br/>
          the texture of experience,<br/>
          the weight of years.</p>

          <p style="margin-top: 20px;">But I can't search my way<br/>
          back to the smell of my grandmother's kitchen,<br/>
          can't backup the sound<br/>
          of rain on my childhood roof.</p>

          <p style="margin-top: 20px;">Some files corrupt,<br/>
          some formats become obsolete,<br/>
          some memories live only<br/>
          in the soft disk of the heart.</p>

          <p style="margin-top: 20px;">And when the power fails,<br/>
          when the cloud evaporates,<br/>
          when all our careful archives turn to dust—</p>

          <p style="margin-top: 20px;">What remains?<br/>
          Only this: the stories we told,<br/>
          the lives we touched,<br/>
          the love we failed to save<br/>
          but gave away instead.</p>
        </div>

        <div style="text-align: center; margin: 80px 0 40px 0;">
          <p style="font-size: 10pt; font-style: italic;">— End of Collection —</p>
        </div>
      </div>
    `
  },
  {
    id: 'comic-script',
    name: 'Comic Book Script',
    nameKey: 'templateComicScript',
    category: 'Creative',
    categoryKey: 'templateCategoryCreative',
    thumbnail: 'bg-gradient-to-br from-yellow-50 to-amber-50 border border-yellow-300',
    content: `
      <div style="font-family: 'Courier New', monospace; font-size: 11pt; color: #000; line-height: 1.6;">
        <div style="text-align: center; margin-bottom: 40px;">
          <h1 style="font-size: 18pt; font-weight: bold;">THE CODEBREAKER</h1>
          <p style="margin-top: 10px;">Issue #1: "Digital Shadows"</p>
          <p>Written by Jane Doe</p>
          <p>Art by [Artist Name]</p>
        </div>

        <div style="border-bottom: 2px solid #000; margin: 30px 0;"></div>

        <p style="font-weight: bold; margin-bottom: 20px;">PAGE ONE (5 Panels)</p>

        <p style="margin-bottom: 20px;">
          <strong>Panel 1:</strong> SPLASH PAGE. Establishing shot of Neo-Tokyo at night, 2045. Massive holographic advertisements cover the sides of skyscrapers, casting blue and purple light over rain-slicked streets. Flying cars weave between buildings. In the foreground, we see the silhouette of our hero, CIPHER (mid-20s, athletic build, wearing a sleek black tactical suit with glowing circuit patterns), standing on a rooftop edge.
        </p>

        <p style="margin-left: 40px; margin-bottom: 20px;">
          <strong>CAPTION (Cipher):</strong> They say information wants to be free.
        </p>

        <p style="margin-left: 40px; margin-bottom: 20px;">
          <strong>CAPTION (Cipher):</strong> The corporations who control it disagree.
        </p>

        <p style="margin-bottom: 20px;">
          <strong>Panel 2:</strong> Close-up on Cipher's face, half-illuminated by the glow from her cybernetic eye implant (right eye, with visible circuitry beneath translucent skin). She's focused, determined. Rain beads on her face.
        </p>

        <p style="margin-left: 40px; margin-bottom: 20px;">
          <strong>CAPTION (Cipher):</strong> I'm here to settle that argument.
        </p>

        <p style="margin-bottom: 20px;">
          <strong>Panel 3:</strong> Wide shot. Cipher leaps from the rooftop, arms spread, cape billowing behind her. The building behind her is the OmniCorp Tower—sleek, imposing, covered in their logo.
        </p>

        <p style="margin-left: 40px; margin-bottom: 20px;">
          <strong>SFX:</strong> WHOOOOSH
        </p>

        <p style="margin-bottom: 20px;">
          <strong>Panel 4:</strong> Cipher's gloved hand slaps against the glass exterior of the building twenty floors down. She's using gecko-grip technology to cling to the surface. Her other hand is already working on a portable hacking device attached to her wrist.
        </p>

        <p style="margin-left: 40px; margin-bottom: 20px;">
          <strong>SFX:</strong> SHHHHK (hand hitting glass)
        </p>

        <p style="margin-left: 40px; margin-bottom: 20px;">
          <strong>SFX:</strong> beep beep beep (hacking device)
        </p>

        <p style="margin-bottom: 20px;">
          <strong>Panel 5:</strong> Close-up on Cipher's wrist device. The screen shows lines of code scrolling rapidly. In the reflection of the screen, we can see her cybernetic eye glowing brighter, processing information.
        </p>

        <p style="margin-left: 40px; margin-bottom: 20px;">
          <strong>CIPHER:</strong> Come on... just a few more seconds...
        </p>

        <p style="margin-left: 40px; margin-bottom: 20px;">
          <strong>DEVICE TEXT:</strong> ACCESS GRANTED
        </p>

        <div style="border-bottom: 2px solid #000; margin: 30px 0;"></div>

        <p style="font-weight: bold; margin-bottom: 20px;">PAGE TWO (6 Panels)</p>

        <p style="margin-bottom: 20px;">
          <strong>Panel 1:</strong> Interior of OmniCorp server room. Massive server towers stretch into the distance, lit by pulsing blue lights. Cipher drops down from a ceiling vent, landing in a crouch. She's graceful, cat-like.
        </p>

        <p style="margin-left: 40px; margin-bottom: 20px;">
          <strong>SFX:</strong> THUD
        </p>

        <p style="margin-left: 40px; margin-bottom: 20px;">
          <strong>CIPHER (whisper):</strong> I'm in.
        </p>

        <p style="margin-bottom: 20px;">
          <strong>Panel 2:</strong> Cipher approaches the central server console. Her fingers fly across a holographic keyboard that materializes from her wrist device.
        </p>

        <p style="margin-left: 40px; margin-bottom: 20px;">
          <strong>VOICE (from comms):</strong> &lt;You've got maybe three minutes before their AI detects the intrusion.&gt;
        </p>

        <p style="margin-left: 40px; margin-bottom: 20px;">
          <strong>CIPHER:</strong> I only need two, Ghost.
        </p>

        <p style="margin-bottom: 20px;">
          <strong>Panel 3:</strong> Split panel. TOP: Cipher's hands on the holographic interface, data streams flowing around her. BOTTOM: Across the city, in a dark apartment, we see GHOST (early 30s, disheveled, surrounded by monitors), her remote partner, watching multiple screens showing Cipher's vitals and the facility's security systems.
        </p>

        <p style="margin-left: 40px; margin-bottom: 20px;">
          <strong>GHOST:</strong> &lt;Famous last words, Cipher.&gt;
        </p>

        <p style="margin-bottom: 20px;">
          <strong>Panel 4:</strong> Close-up on a specific file on Cipher's display: "PROJECT PARADIGM - CLASSIFIED." Her cybernetic eye zooms in on it digitally.
        </p>

        <p style="margin-left: 40px; margin-bottom: 20px;">
          <strong>CIPHER:</strong> Wait... what is this?
        </p>

        <p style="margin-bottom: 20px;">
          <strong>Panel 5:</strong> Cipher's face, shocked, as she reads the data. The blue light from the screens reflects off her face, showing genuine horror.
        </p>

        <p style="margin-left: 40px; margin-bottom: 20px;">
          <strong>CIPHER:</strong> Oh god. Ghost, they're not just stealing data. They're stealing *minds*.
        </p>

        <p style="margin-bottom: 20px;">
          <strong>Panel 6:</strong> Wide shot. Suddenly, red warning lights flood the server room. Alarms begin to blare. Cipher looks up, tensed, ready for action.
        </p>

        <p style="margin-left: 40px; margin-bottom: 20px;">
          <strong>SFX:</strong> WHOOP WHOOP WHOOP
        </p>

        <p style="margin-left: 40px; margin-bottom: 20px;">
          <strong>AUTOMATED VOICE:</strong> INTRUDER DETECTED. SECURITY PROTOCOLS ENGAGED.
        </p>

        <p style="margin-left: 40px; margin-bottom: 20px;">
          <strong>GHOST:</strong> &lt;Cipher, you need to get out of there NOW!&gt;
        </p>

        <div style="border-bottom: 2px solid #000; margin: 30px 0;"></div>

        <p style="font-weight: bold; margin-bottom: 20px;">PAGE THREE (Continued...)</p>

        <p style="font-style: italic; margin-top: 40px;">[Script continues with the action sequence as Cipher battles security drones while escaping with the stolen data...]</p>

        <div style="margin-top: 60px; padding: 20px; background-color: #f0f0f0; border-left: 4px solid #000;">
          <p style="font-weight: bold; margin-bottom: 10px;">WRITER'S NOTES:</p>
          <ul style="margin-left: 20px; line-height: 1.8;">
            <li>Cipher's cybernetic eye should glow brighter when she's processing data or using enhanced abilities</li>
            <li>Neo-Tokyo should feel lived-in and gritty despite the high-tech setting—think Blade Runner meets Ghost in the Shell</li>
            <li>The relationship between Cipher and Ghost should show trust and familiarity; they've been partners for years</li>
            <li>Keep the action dynamic—this is a heist story with superhero elements</li>
          </ul>
        </div>
      </div>
    `
  },
  {
    id: 'api-documentation',
    name: 'API Documentation',
    nameKey: 'templateAPIDocumentation',
    category: 'Technical',
    categoryKey: 'templateCategoryTechnical',
    thumbnail: 'bg-gradient-to-br from-green-50 to-emerald-50 border border-green-300',
    content: `
      <div style="font-family: 'Arial', sans-serif; font-size: 11pt; color: #1f2937; max-width: 8in; margin: 0 auto;">
        <h1 style="color: #059669; border-bottom: 3px solid #10b981; padding-bottom: 15px; margin-bottom: 30px;">CloudWord API Documentation</h1>

        <div style="background-color: #d1fae5; padding: 20px; border-left: 4px solid #10b981; margin-bottom: 30px;">
          <p style="margin: 0;"><strong>Base URL:</strong> <code>https://api.cloudword.com/v1</code></p>
          <p style="margin: 10px 0 0 0;"><strong>Authentication:</strong> Bearer Token (OAuth 2.0)</p>
        </div>

        <!-- Overview -->
        <h2 style="color: #047857; margin-top: 40px; margin-bottom: 15px;">Overview</h2>
        <p style="line-height: 1.8; margin-bottom: 15px;">The CloudWord API provides programmatic access to document management, editing, and collaboration features. This RESTful API uses JSON for request and response payloads.</p>

        <p style="line-height: 1.8; margin-bottom: 20px;"><strong>Key Features:</strong></p>
        <ul style="line-height: 1.8; margin-left: 30px; margin-bottom: 30px;">
          <li>Create, read, update, and delete documents</li>
          <li>Real-time collaboration and synchronization</li>
          <li>Template management</li>
          <li>Export documents in multiple formats</li>
          <li>Version history and recovery</li>
        </ul>

        <!-- Authentication -->
        <h2 style="color: #047857; margin-top: 40px; margin-bottom: 15px;">Authentication</h2>
        <p style="line-height: 1.8; margin-bottom: 15px;">All API requests require authentication using Bearer tokens. Include your API key in the Authorization header:</p>

        <div style="background-color: #f3f4f6; padding: 15px; font-family: 'Courier New', monospace; font-size: 10pt; border-radius: 4px; margin-bottom: 20px; border: 1px solid #d1d5db;">
          <code>Authorization: Bearer YOUR_API_KEY</code>
        </div>

        <p style="line-height: 1.8; margin-bottom: 20px;">Obtain your API key from the <a href="#" style="color: #059669;">developer dashboard</a>.</p>

        <!-- Rate Limiting -->
        <h2 style="color: #047857; margin-top: 40px; margin-bottom: 15px;">Rate Limiting</h2>
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 30px;">
          <tr style="background-color: #d1fae5;">
            <th style="padding: 12px; text-align: left; border: 1px solid #a7f3d0;">Plan</th>
            <th style="padding: 12px; text-align: left; border: 1px solid #a7f3d0;">Requests per Hour</th>
            <th style="padding: 12px; text-align: left; border: 1px solid #a7f3d0;">Burst Limit</th>
          </tr>
          <tr>
            <td style="padding: 12px; border: 1px solid #e5e7eb;">Free</td>
            <td style="padding: 12px; border: 1px solid #e5e7eb;">1,000</td>
            <td style="padding: 12px; border: 1px solid #e5e7eb;">50</td>
          </tr>
          <tr style="background-color: #f9fafb;">
            <td style="padding: 12px; border: 1px solid #e5e7eb;">Pro</td>
            <td style="padding: 12px; border: 1px solid #e5e7eb;">10,000</td>
            <td style="padding: 12px; border: 1px solid #e5e7eb;">200</td>
          </tr>
          <tr>
            <td style="padding: 12px; border: 1px solid #e5e7eb;">Enterprise</td>
            <td style="padding: 12px; border: 1px solid #e5e7eb;">100,000</td>
            <td style="padding: 12px; border: 1px solid #e5e7eb;">1,000</td>
          </tr>
        </table>

        <!-- Endpoints -->
        <h2 style="color: #047857; margin-top: 40px; margin-bottom: 15px;">Endpoints</h2>

        <!-- Create Document -->
        <h3 style="color: #059669; margin-top: 30px; margin-bottom: 10px; font-size: 13pt;">Create Document</h3>

        <div style="background-color: #ecfdf5; padding: 12px; border-radius: 4px; margin-bottom: 15px;">
          <code style="color: #047857; font-weight: bold;">POST /documents</code>
        </div>

        <p style="line-height: 1.8; margin-bottom: 15px;">Creates a new document in the user's account.</p>

        <p style="font-weight: bold; margin-bottom: 10px;">Request Body:</p>
        <div style="background-color: #f3f4f6; padding: 15px; font-family: 'Courier New', monospace; font-size: 10pt; border-radius: 4px; margin-bottom: 20px; border: 1px solid #d1d5db;">
<code>{
  "title": "My New Document",
  "content": "&lt;p&gt;Hello, World!&lt;/p&gt;",
  "template_id": "blank-document",
  "tags": ["draft", "personal"],
  "is_public": false
}</code>
        </div>

        <p style="font-weight: bold; margin-bottom: 10px;">Response (201 Created):</p>
        <div style="background-color: #f3f4f6; padding: 15px; font-family: 'Courier New', monospace; font-size: 10pt; border-radius: 4px; margin-bottom: 20px; border: 1px solid #d1d5db;">
<code>{
  "id": "doc_7h3k9s2m",
  "title": "My New Document",
  "content": "&lt;p&gt;Hello, World!&lt;/p&gt;",
  "template_id": "blank-document",
  "tags": ["draft", "personal"],
  "is_public": false,
  "created_at": "2025-12-25T18:30:00Z",
  "updated_at": "2025-12-25T18:30:00Z",
  "author": {
    "id": "user_5k2n8x",
    "name": "Jane Doe",
    "email": "jane@example.com"
  }
}</code>
        </div>

        <!-- Get Document -->
        <h3 style="color: #059669; margin-top: 30px; margin-bottom: 10px; font-size: 13pt;">Get Document</h3>

        <div style="background-color: #ecfdf5; padding: 12px; border-radius: 4px; margin-bottom: 15px;">
          <code style="color: #047857; font-weight: bold;">GET /documents/{document_id}</code>
        </div>

        <p style="line-height: 1.8; margin-bottom: 15px;">Retrieves a specific document by ID.</p>

        <p style="font-weight: bold; margin-bottom: 10px;">Path Parameters:</p>
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
          <tr style="background-color: #f9fafb;">
            <th style="padding: 10px; text-align: left; border: 1px solid #e5e7eb; width: 25%;">Parameter</th>
            <th style="padding: 10px; text-align: left; border: 1px solid #e5e7eb; width: 15%;">Type</th>
            <th style="padding: 10px; text-align: left; border: 1px solid #e5e7eb;">Description</th>
          </tr>
          <tr>
            <td style="padding: 10px; border: 1px solid #e5e7eb;"><code>document_id</code></td>
            <td style="padding: 10px; border: 1px solid #e5e7eb;">string</td>
            <td style="padding: 10px; border: 1px solid #e5e7eb;">The unique identifier of the document</td>
          </tr>
        </table>

        <p style="font-weight: bold; margin-bottom: 10px;">Response (200 OK):</p>
        <div style="background-color: #f3f4f6; padding: 15px; font-family: 'Courier New', monospace; font-size: 10pt; border-radius: 4px; margin-bottom: 20px; border: 1px solid #d1d5db;">
<code>{
  "id": "doc_7h3k9s2m",
  "title": "My New Document",
  "content": "&lt;p&gt;Hello, World!&lt;/p&gt;",
  "word_count": 2,
  "character_count": 12,
  "created_at": "2025-12-25T18:30:00Z",
  "updated_at": "2025-12-25T18:30:00Z"
}</code>
        </div>

        <!-- Update Document -->
        <h3 style="color: #059669; margin-top: 30px; margin-bottom: 10px; font-size: 13pt;">Update Document</h3>

        <div style="background-color: #ecfdf5; padding: 12px; border-radius: 4px; margin-bottom: 15px;">
          <code style="color: #047857; font-weight: bold;">PATCH /documents/{document_id}</code>
        </div>

        <p style="line-height: 1.8; margin-bottom: 15px;">Updates specific fields of an existing document.</p>

        <p style="font-weight: bold; margin-bottom: 10px;">Request Body:</p>
        <div style="background-color: #f3f4f6; padding: 15px; font-family: 'Courier New', monospace; font-size: 10pt; border-radius: 4px; margin-bottom: 20px; border: 1px solid #d1d5db;">
<code>{
  "title": "Updated Title",
  "content": "&lt;p&gt;Updated content here&lt;/p&gt;"
}</code>
        </div>

        <!-- Error Responses -->
        <h2 style="color: #047857; margin-top: 40px; margin-bottom: 15px;">Error Responses</h2>

        <p style="line-height: 1.8; margin-bottom: 15px;">The API uses standard HTTP status codes and returns error details in the following format:</p>

        <div style="background-color: #f3f4f6; padding: 15px; font-family: 'Courier New', monospace; font-size: 10pt; border-radius: 4px; margin-bottom: 20px; border: 1px solid #d1d5db;">
<code>{
  "error": {
    "code": "DOCUMENT_NOT_FOUND",
    "message": "The requested document does not exist",
    "status": 404
  }
}</code>
        </div>

        <table style="width: 100%; border-collapse: collapse; margin-bottom: 30px;">
          <tr style="background-color: #f9fafb;">
            <th style="padding: 10px; text-align: left; border: 1px solid #e5e7eb; width: 20%;">Status Code</th>
            <th style="padding: 10px; text-align: left; border: 1px solid #e5e7eb;">Description</th>
          </tr>
          <tr>
            <td style="padding: 10px; border: 1px solid #e5e7eb;">400</td>
            <td style="padding: 10px; border: 1px solid #e5e7eb;">Bad Request - Invalid parameters or malformed JSON</td>
          </tr>
          <tr style="background-color: #f9fafb;">
            <td style="padding: 10px; border: 1px solid #e5e7eb;">401</td>
            <td style="padding: 10px; border: 1px solid #e5e7eb;">Unauthorized - Invalid or missing API key</td>
          </tr>
          <tr>
            <td style="padding: 10px; border: 1px solid #e5e7eb;">404</td>
            <td style="padding: 10px; border: 1px solid #e5e7eb;">Not Found - Resource does not exist</td>
          </tr>
          <tr style="background-color: #f9fafb;">
            <td style="padding: 10px; border: 1px solid #e5e7eb;">429</td>
            <td style="padding: 10px; border: 1px solid #e5e7eb;">Too Many Requests - Rate limit exceeded</td>
          </tr>
          <tr>
            <td style="padding: 10px; border: 1px solid #e5e7eb;">500</td>
            <td style="padding: 10px; border: 1px solid #e5e7eb;">Internal Server Error - Something went wrong on our end</td>
          </tr>
        </table>

        <!-- Support -->
        <div style="background-color: #f0fdfa; padding: 20px; border-left: 4px solid #14b8a6; margin-top: 40px;">
          <h3 style="color: #0f766e; margin-top: 0;">Need Help?</h3>
          <p style="margin-bottom: 10px;">Contact our developer support team:</p>
          <ul style="margin-left: 20px; line-height: 1.8;">
            <li>Email: <a href="mailto:api@cloudword.com" style="color: #059669;">api@cloudword.com</a></li>
            <li>Documentation: <a href="#" style="color: #059669;">https://docs.cloudword.com</a></li>
            <li>Discord: <a href="#" style="color: #059669;">CloudWord Developers</a></li>
          </ul>
        </div>
      </div>
    `
  },
  {
    id: 'user-manual',
    name: 'User Manual',
    nameKey: 'templateUserManual',
    category: 'Technical',
    categoryKey: 'templateCategoryTechnical',
    thumbnail: 'bg-gradient-to-br from-sky-50 to-blue-50 border border-sky-300',
    content: `
      <div style="font-family: 'Arial', sans-serif; font-size: 11pt; color: #1f2937;">
        <!-- Cover Page -->
        <div style="text-align: center; padding: 100px 0;">
          <h1 style="font-size: 36pt; font-weight: bold; color: #0369a1; margin-bottom: 20px;">USER MANUAL</h1>
          <h2 style="font-size: 24pt; color: #0284c7; margin-bottom: 60px;">CloudWord Document Editor</h2>

          <div style="margin: 60px 0;">
            <p style="font-size: 14pt; margin-bottom: 20px;">Version 1.0</p>
            <p style="font-size: 12pt; margin-bottom: 5px;">December 2025</p>
          </div>

          <div style="margin-top: 100px; font-size: 10pt; color: #6b7280;">
            <p>© 2025 Penko Technologies, Inc.</p>
            <p>All Rights Reserved</p>
          </div>
        </div>

        <div style="page-break-before: always; height: 1px;"></div>

        <!-- Table of Contents -->
        <h2 style="color: #0369a1; border-bottom: 3px solid #0284c7; padding-bottom: 10px; margin-bottom: 20px;">TABLE OF CONTENTS</h2>

        <div style="line-height: 2.0; margin-bottom: 40px;">
          <p style="margin-left: 20px;"><strong>1. Getting Started</strong> ................................ 3</p>
          <p style="margin-left: 40px;">1.1 System Requirements ................................ 3</p>
          <p style="margin-left: 40px;">1.2 Installation ................................ 4</p>
          <p style="margin-left: 40px;">1.3 First Launch ................................ 5</p>

          <p style="margin-left: 20px; margin-top: 10px;"><strong>2. Basic Features</strong> ................................ 6</p>
          <p style="margin-left: 40px;">2.1 Creating Documents ................................ 6</p>
          <p style="margin-left: 40px;">2.2 Formatting Text ................................ 7</p>
          <p style="margin-left: 40px;">2.3 Saving and Exporting ................................ 9</p>

          <p style="margin-left: 20px; margin-top: 10px;"><strong>3. Advanced Features</strong> ................................ 11</p>
          <p style="margin-left: 40px;">3.1 Templates ................................ 11</p>
          <p style="margin-left: 40px;">3.2 Collaboration ................................ 13</p>
          <p style="margin-left: 40px;">3.3 Version History ................................ 15</p>

          <p style="margin-left: 20px; margin-top: 10px;"><strong>4. Troubleshooting</strong> ................................ 17</p>
        </div>

        <div style="page-break-before: always; height: 1px;"></div>

        <!-- Chapter 1 -->
        <h2 style="color: #0369a1; border-bottom: 3px solid #0284c7; padding-bottom: 10px; margin-bottom: 20px;">1. GETTING STARTED</h2>

        <p style="line-height: 1.8; margin-bottom: 20px;">Welcome to CloudWord! This user manual will guide you through all the features and capabilities of our document editing platform.</p>

        <h3 style="color: #0284c7; margin-top: 30px; margin-bottom: 15px;">1.1 System Requirements</h3>

        <p style="line-height: 1.8; margin-bottom: 15px;">Before installing CloudWord, ensure your system meets the following minimum requirements:</p>

        <div style="background-color: #e0f2fe; padding: 20px; border-left: 4px solid #0284c7; margin: 20px 0;">
          <p style="font-weight: bold; margin-bottom: 10px;">Minimum Requirements:</p>
          <ul style="margin-left: 20px; line-height: 1.8;">
            <li>Modern web browser (Chrome 90+, Firefox 88+, Safari 14+, or Edge 90+)</li>
            <li>4 GB RAM minimum (8 GB recommended)</li>
            <li>Internet connection for cloud features (offline mode available)</li>
            <li>100 MB free disk space for local storage</li>
          </ul>
        </div>

        <h3 style="color: #0284c7; margin-top: 30px; margin-bottom: 15px;">1.2 Installation</h3>

        <p style="line-height: 1.8; margin-bottom: 15px;">CloudWord is a web-based application and requires no traditional installation. Follow these steps to get started:</p>

        <div style="background-color: #f0f9ff; padding: 15px; margin: 20px 0; border: 1px solid #bae6fd; border-radius: 4px;">
          <p style="font-weight: bold; margin-bottom: 10px;">Step 1: Access the Application</p>
          <ol style="margin-left: 20px; line-height: 1.8;">
            <li>Open your web browser</li>
            <li>Navigate to <code>https://app.cloudword.com</code></li>
            <li>Wait for the application to load (first load may take 10-15 seconds)</li>
          </ol>
        </div>

        <div style="background-color: #f0f9ff; padding: 15px; margin: 20px 0; border: 1px solid #bae6fd; border-radius: 4px;">
          <p style="font-weight: bold; margin-bottom: 10px;">Step 2: Create an Account</p>
          <ol style="margin-left: 20px; line-height: 1.8;">
            <li>Click the "Sign Up" button in the top-right corner</li>
            <li>Enter your email address and choose a secure password</li>
            <li>Verify your email by clicking the link sent to your inbox</li>
            <li>Log in with your credentials</li>
          </ol>
        </div>

        <div style="background-color: #fff7ed; padding: 15px; margin: 20px 0; border-left: 4px solid #fb923c;">
          <p style="font-weight: bold; color: #c2410c; margin-bottom: 10px;">⚠️ Important Note:</p>
          <p style="line-height: 1.8;">For enhanced security, we recommend enabling two-factor authentication in your account settings after your first login.</p>
        </div>

        <h3 style="color: #0284c7; margin-top: 30px; margin-bottom: 15px;">1.3 First Launch</h3>

        <p style="line-height: 1.8; margin-bottom: 15px;">When you first launch CloudWord, you'll be greeted with a welcome tutorial. We recommend completing this 5-minute introduction to familiarize yourself with the interface.</p>

        <p style="line-height: 1.8; margin-bottom: 20px;">The main interface consists of four key areas:</p>

        <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
          <tr style="background-color: #e0f2fe;">
            <th style="padding: 12px; text-align: left; border: 1px solid #7dd3fc; width: 25%;">Component</th>
            <th style="padding: 12px; text-align: left; border: 1px solid #7dd3fc;">Description</th>
          </tr>
          <tr>
            <td style="padding: 12px; border: 1px solid #e5e7eb; font-weight: bold;">Sidebar</td>
            <td style="padding: 12px; border: 1px solid #e5e7eb;">Access your documents, templates, and settings</td>
          </tr>
          <tr style="background-color: #f9fafb;">
            <td style="padding: 12px; border: 1px solid #e5e7eb; font-weight: bold;">Ribbon</td>
            <td style="padding: 12px; border: 1px solid #e5e7eb;">Quick access to formatting tools and features</td>
          </tr>
          <tr>
            <td style="padding: 12px; border: 1px solid #e5e7eb; font-weight: bold;">Editor</td>
            <td style="padding: 12px; border: 1px solid #e5e7eb;">Main writing area where you create and edit content</td>
          </tr>
          <tr style="background-color: #f9fafb;">
            <td style="padding: 12px; border: 1px solid #e5e7eb; font-weight: bold;">Status Bar</td>
            <td style="padding: 12px; border: 1px solid #e5e7eb;">Displays word count, save status, and other information</td>
          </tr>
        </table>

        <div style="page-break-before: always; height: 1px;"></div>

        <!-- Chapter 2 -->
        <h2 style="color: #0369a1; border-bottom: 3px solid #0284c7; padding-bottom: 10px; margin-bottom: 20px;">2. BASIC FEATURES</h2>

        <h3 style="color: #0284c7; margin-top: 30px; margin-bottom: 15px;">2.1 Creating Documents</h3>

        <p style="line-height: 1.8; margin-bottom: 15px;">Creating a new document in CloudWord is simple:</p>

        <ol style="margin-left: 30px; line-height: 2.0; margin-bottom: 20px;">
          <li>Click the <strong>"New"</strong> button in the sidebar (or press <kbd>Ctrl+N</kbd> / <kbd>⌘+N</kbd>)</li>
          <li>Choose to start with a blank document or select a template</li>
          <li>Begin typing immediately—your document auto-saves every few seconds</li>
        </ol>

        <div style="background-color: #ecfdf5; padding: 15px; margin: 20px 0; border-left: 4px solid #10b981;">
          <p style="font-weight: bold; color: #065f46; margin-bottom: 10px;">💡 Pro Tip:</p>
          <p style="line-height: 1.8;">Use the Templates button to explore professionally designed formats for resumes, reports, academic papers, and more. Templates save time and ensure proper formatting.</p>
        </div>

        <h3 style="color: #0284c7; margin-top: 30px; margin-bottom: 15px;">2.2 Formatting Text</h3>

        <p style="line-height: 1.8; margin-bottom: 15px;">CloudWord offers comprehensive text formatting options accessible through the Ribbon or keyboard shortcuts:</p>

        <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
          <tr style="background-color: #e0f2fe;">
            <th style="padding: 12px; text-align: left; border: 1px solid #7dd3fc;">Formatting</th>
            <th style="padding: 12px; text-align: left; border: 1px solid #7dd3fc;">Windows Shortcut</th>
            <th style="padding: 12px; text-align: left; border: 1px solid #7dd3fc;">Mac Shortcut</th>
          </tr>
          <tr>
            <td style="padding: 12px; border: 1px solid #e5e7eb;">Bold</td>
            <td style="padding: 12px; border: 1px solid #e5e7eb;"><kbd>Ctrl+B</kbd></td>
            <td style="padding: 12px; border: 1px solid #e5e7eb;"><kbd>⌘+B</kbd></td>
          </tr>
          <tr style="background-color: #f9fafb;">
            <td style="padding: 12px; border: 1px solid #e5e7eb;">Italic</td>
            <td style="padding: 12px; border: 1px solid #e5e7eb;"><kbd>Ctrl+I</kbd></td>
            <td style="padding: 12px; border: 1px solid #e5e7eb;"><kbd>⌘+I</kbd></td>
          </tr>
          <tr>
            <td style="padding: 12px; border: 1px solid #e5e7eb;">Underline</td>
            <td style="padding: 12px; border: 1px solid #e5e7eb;"><kbd>Ctrl+U</kbd></td>
            <td style="padding: 12px; border: 1px solid #e5e7eb;"><kbd>⌘+U</kbd></td>
          </tr>
          <tr style="background-color: #f9fafb;">
            <td style="padding: 12px; border: 1px solid #e5e7eb;">Undo</td>
            <td style="padding: 12px; border: 1px solid #e5e7eb;"><kbd>Ctrl+Z</kbd></td>
            <td style="padding: 12px; border: 1px solid #e5e7eb;"><kbd>⌘+Z</kbd></td>
          </tr>
          <tr>
            <td style="padding: 12px; border: 1px solid #e5e7eb;">Redo</td>
            <td style="padding: 12px; border: 1px solid #e5e7eb;"><kbd>Ctrl+Y</kbd></td>
            <td style="padding: 12px; border: 1px solid #e5e7eb;"><kbd>⌘+Shift+Z</kbd></td>
          </tr>
        </table>

        <!-- Support Section -->
        <div style="page-break-before: always; height: 1px;"></div>

        <h2 style="color: #0369a1; border-bottom: 3px solid #0284c7; padding-bottom: 10px; margin-bottom: 20px;">SUPPORT & RESOURCES</h2>

        <p style="line-height: 1.8; margin-bottom: 20px;">If you need additional assistance, we offer multiple support channels:</p>

        <div style="background-color: #f0f9ff; padding: 25px; border: 2px solid #0284c7; border-radius: 8px; margin: 20px 0;">
          <h3 style="color: #0369a1; margin-top: 0; margin-bottom: 15px;">Contact Information</h3>

          <p style="margin-bottom: 10px;"><strong>Email Support:</strong> support@cloudword.com</p>
          <p style="margin-bottom: 10px;"><strong>Phone:</strong> 1-800-CLOUDWORD (24/7)</p>
          <p style="margin-bottom: 10px;"><strong>Live Chat:</strong> Available in-app (Mon-Fri, 9 AM - 6 PM EST)</p>
          <p style="margin-bottom: 10px;"><strong>Knowledge Base:</strong> help.cloudword.com</p>
          <p style="margin-bottom: 10px;"><strong>Video Tutorials:</strong> youtube.com/cloudword</p>
          <p><strong>Community Forum:</strong> community.cloudword.com</p>
        </div>

        <div style="text-align: center; margin-top: 60px; padding-top: 30px; border-top: 1px solid #d1d5db;">
          <p style="font-size: 10pt; color: #6b7280;">Thank you for choosing CloudWord!</p>
          <p style="font-size: 10pt; color: #6b7280; margin-top: 5px;">Version 1.0 | December 2025</p>
        </div>
      </div>
    `
  }
];

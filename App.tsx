
import React, { useState, useMemo, useEffect } from 'react';
import Header from './components/Header';
import Footer from './components/Footer';
import Hero from './components/Hero';
import Features from './components/Features';
import Testimonials from './components/Testimonials';
import CallToAction from './components/CallToAction';
import AITutor from './components/AITutor';
import SocraticTutor from './components/SocraticTutor';
import LoginModal from './components/LoginModal';
import Dashboard from './components/Dashboard';
import Alchemy from './components/Alchemy';
import KnowledgeGraph from './components/KnowledgeGraph';
import NoteTaking from './components/NoteTaking';
import { DriveStorage } from './components/DriveStorage'; // Replaced CramMode
import ThingsToDo from './components/ThingsToDo'; 
import VideoCourse from './components/VideoCourse';
import Community from './components/Community'; 
import { LearnWithPeople } from './components/LearnWithPeople'; 
import { FriendManager } from './components/FriendManager';
import { GlobalTodoPanel } from './components/GlobalTodoPanel'; // Import Global Todo
import About from './components/About';
import Vision from './components/Vision';
import Mission from './components/Mission';
import Story from './components/Story';
import Team from './components/Team';
import Contact from './components/Contact';
import ExploreGraph from './components/ExploreGraph';
import ExploreSearch from './components/ExploreSearch';
import ExploreCategory from './components/ExploreCategory';
import ExploreTopic from './components/ExploreTopic';
import ExploreDifficulty from './components/ExploreDifficulty';
import ExploreSkill from './components/ExploreSkill';
import FAQ from './components/FAQ';
import Account from './components/Account';
import LearningModal from './components/LearningModal';
import DrawEverything from './components/DrawEverything'; 
import DrawingManager from './components/DrawingManager';
import AchievementGallery from './components/AchievementGallery'; // Import Achievements
import { NeuralFeedbackWidget } from './components/NeuralFeedbackWidget'; // NEW WIDGET
import { KnowledgeNode, SavedDrawing, AlchemyIntent, Quest, TodoTask } from './types';
import { getGlobalStats } from './services/sm2Service';
import { analyzeImageForDiscussion } from './services/geminiService';
import { useGamification } from './contexts/GamificationContext'; 
import { useBehavior } from './contexts/BehaviorContext'; // Tracking Context
import { getCurrentUser, getUserNodes, saveUserNodes, logoutUser } from './services/mockBackend';

type ViewState = 'landing' | 'dashboard' | 'tutor' | 'alchemy' | 'knowledge-graph' | 'media' | 'drive' | 'digest' | 'video' | 'community' | 'battle' | 'about' | 'vision' | 'mission' | 'story' | 'team' | 'contact' | 'explore-graph' | 'explore-search' | 'explore-category' | 'explore-topic' | 'explore-difficulty' | 'explore-skill' | 'faq' | 'account' | 'draw' | 'drawing-manager' | 'achievements';

function App() {
  const [view, setView] = useState<ViewState>('landing');
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isFriendManagerOpen, setIsFriendManagerOpen] = useState(false); 
  const [isTodoPanelOpen, setIsTodoPanelOpen] = useState(false); // Global Todo State
  
  // Navigation State
  const [scrollToFeatures, setScrollToFeatures] = useState(false);

  // DATA: Nodes are now loaded from the mock backend service
  const [userNodes, setUserNodes] = useState<KnowledgeNode[]>([]);
  const [selectedNode, setSelectedNode] = useState<KnowledgeNode | null>(null);
  
  // --- SYNC STATE (The Glue) ---
  const [activeTagFilter, setActiveTagFilter] = useState<string | null>(null);
  const [focusedNodeId, setFocusedNodeId] = useState<string | null>(null);
  
  // --- GAMIFICATION STATE (Replaced by Context) ---
  const { progress, addXP } = useGamification();
  const { logAction } = useBehavior(); // Usage of new Behavior Context
  
  const [quests, setQuests] = useState<Quest[]>([]);
  const [activeAchievement, setActiveAchievement] = useState<{title: string, desc: string} | null>(null);

  // --- TODO STATE ---
  const [tasks, setTasks] = useState<TodoTask[]>([]);

  // --- ALCHEMY INTENT STATE (10 Flows) ---
  const [alchemyIntent, setAlchemyIntent] = useState<AlchemyIntent | null>(null);

  const [tutorContext, setTutorContext] = useState<string>('');
  const [tutorContextNode, setTutorContextNode] = useState<KnowledgeNode | null>(null);

  const [learningQueue, setLearningQueue] = useState<KnowledgeNode[]>([]);
  const [currentPlaylistIndex, setCurrentPlaylistIndex] = useState(0);

  // Drawing State
  const [currentDrawing, setCurrentDrawing] = useState<SavedDrawing | null>(null);

  const stats = useMemo(() => getGlobalStats(userNodes), [userNodes]);

  // --- AUTH & DATA LOADING ---
  useEffect(() => {
    // Check session on load
    const user = getCurrentUser();
    if (user) {
        setIsLoggedIn(true);
        setView('dashboard');
        // Load User Data
        setUserNodes(getUserNodes());
    }

    // Load Tasks
    const storedTasks = localStorage.getItem('learnai_todos');
    if (storedTasks) {
        setTasks(JSON.parse(storedTasks));
    }
  }, []);

  // Save nodes whenever they change (if logged in)
  useEffect(() => {
      if (isLoggedIn) {
          saveUserNodes(userNodes);
      }
  }, [userNodes, isLoggedIn]);

  // Save tasks whenever they change
  useEffect(() => {
      if (tasks.length > 0) {
          localStorage.setItem('learnai_todos', JSON.stringify(tasks));
      }
  }, [tasks]);

  const handleStart = () => { setIsLoginModalOpen(true); };
  const handleLoginClick = () => { setIsLoginModalOpen(true); };
  const handleCloseModal = () => { setIsLoginModalOpen(false); };
  
  const handleLoginSuccess = () => { 
      setIsLoginModalOpen(false); 
      setIsLoggedIn(true); 
      // Load Data specific to this user
      setUserNodes(getUserNodes());
      setView('dashboard'); 
      logAction('view_feature', 'Login', 'User Logged In');
      window.scrollTo({ top: 0, behavior: 'smooth' }); 
  };
  
  const handleLogout = () => { 
      logoutUser();
      setIsLoggedIn(false); 
      setUserNodes([]); // Clear data from memory
      setView('landing'); 
      logAction('view_feature', 'Logout', 'User Logged Out');
      window.scrollTo({ top: 0, behavior: 'smooth' }); 
  };

  const handleFeatureSelect = (feature: string) => {
    // Log the navigation using the deep learning tracking context
    logAction('view_feature', feature, `Navigated to ${feature}`);

    if (feature === 'alchemy') { 
        setAlchemyIntent({ type: 'create' }); // Default intent
        setView('alchemy'); 
    }
    else if (feature === 'knowledge-graph') { setActiveTagFilter(null); setFocusedNodeId(null); setView('explore-graph'); }
    else if (feature === 'media') setView('media');
    else if (feature === 'tutor') { setView('tutor'); setTutorContext(''); setTutorContextNode(null); }
    else if (feature === 'drive') setView('drive'); 
    else if (feature === 'digest') { setView('digest'); } 
    else if (feature === 'video') setView('video');
    else if (feature === 'community') setView('community'); 
    else if (feature === 'draw') setView('drawing-manager'); 
    else if (feature === 'explore-graph') { setActiveTagFilter(null); setFocusedNodeId(null); setView('explore-graph'); }
    else if (feature === 'achievements') setView('achievements');
    else if (feature === 'dashboard') setView('dashboard');
    else setView('tutor');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleGoBackToDashboard = () => { setView('dashboard'); window.scrollTo({ top: 0, behavior: 'smooth' }); };

  // --- NEW: Global Feature Navigation Handler ---
  const handleGoToFeatures = () => {
      if (view !== 'dashboard') {
          setView('dashboard');
      }
      setScrollToFeatures(true);
      if (view === 'dashboard') {
          setTimeout(() => {
              const el = document.getElementById('feature-navigation-grid');
              if(el) el.scrollIntoView({ behavior: 'smooth' });
          }, 100);
      }
  };

  const handleShowAbout = () => { setView('about'); window.scrollTo({ top: 0, behavior: 'smooth' }); };
  const handleShowVision = () => { setView('vision'); window.scrollTo({ top: 0, behavior: 'smooth' }); };
  const handleShowMission = () => { setView('mission'); window.scrollTo({ top: 0, behavior: 'smooth' }); };
  const handleShowStory = () => { setView('story'); window.scrollTo({ top: 0, behavior: 'smooth' }); };
  const handleShowTeam = () => { setView('team'); window.scrollTo({ top: 0, behavior: 'smooth' }); };
  const handleShowContact = () => { setView('contact'); window.scrollTo({ top: 0, behavior: 'smooth' }); };
  const handleShowFAQ = () => { setView('faq'); window.scrollTo({ top: 0, behavior: 'smooth' }); };
  const handleShowAccount = () => { setView('account'); window.scrollTo({ top: 0, behavior: 'smooth' }); };
  const handleBackFromAbout = () => { isLoggedIn ? setView('dashboard') : setView('landing'); window.scrollTo({ top: 0, behavior: 'smooth' }); };
  const handleBackFromFAQ = () => { isLoggedIn ? setView('dashboard') : setView('landing'); window.scrollTo({ top: 0, behavior: 'smooth' }); };

  const handleAddNode = (node: KnowledgeNode) => {
      setUserNodes(prev => [...prev, node]);
      setFocusedNodeId(node.id);
      addXP(50, "Tạo thẻ mới"); // Award XP via Context
      logAction('create_content', 'Graph', `Created node: ${node.title}`);
  };
  
  const handleAddNodes = (nodes: KnowledgeNode[]) => {
      setUserNodes(prev => [...prev, ...nodes]);
      addXP(nodes.length * 20, "Nhập dữ liệu hàng loạt");
      logAction('create_content', 'Graph', `Bulk created ${nodes.length} nodes`);
  };

  const handleUpdateNode = (updatedNode: KnowledgeNode) => {
      setUserNodes(prev => prev.map(n => n.id === updatedNode.id ? updatedNode : n));
      setLearningQueue(prev => prev.map(n => n.id === updatedNode.id ? updatedNode : n));
      if (selectedNode && selectedNode.id === updatedNode.id) setSelectedNode(updatedNode);
  };

  const handleUpdateNodes = (updatedNodes: KnowledgeNode[]) => {
      setUserNodes(prev => {
          const newNodes = [...prev];
          updatedNodes.forEach(update => {
              const idx = newNodes.findIndex(n => n.id === update.id);
              if (idx !== -1) newNodes[idx] = update;
          });
          return newNodes;
      });
  };

  const handleNavigateToAlchemy = (intent: AlchemyIntent) => {
      setAlchemyIntent(intent);
      setView('alchemy');
      window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // --- GAMIFICATION: Quest Management ---
  const handleRegisterQuest = (quest: Quest) => {
      setQuests(prev => [...prev, quest]);
      if (quest.type === 'LearningPath') {
          setView('explore-graph');
      }
      logAction('click_element', 'Quest', `Registered Quest: ${quest.title}`);
  };

  const handleClaimQuest = (quest: Quest) => {
      setQuests(prev => prev.map(q => q.id === quest.id ? { ...q, completed: true } : q));
      let rewardXP = 100;
      if (quest.reward.includes('XP')) {
          const match = quest.reward.match(/(\d+)/);
          if (match) rewardXP = parseInt(match[0]);
      } else if (quest.type === 'LearningPath') {
          rewardXP = 500;
      }
      
      addXP(rewardXP, `Hoàn thành nhiệm vụ: ${quest.title}`);
      logAction('complete_task', 'Quest', `Claimed Quest: ${quest.title}`);
      
      setActiveAchievement({
          title: "Nhiệm vụ hoàn thành!",
          desc: `Bạn nhận được ${rewardXP} XP từ "${quest.title}".`
      });
  };

  // Use the Context addXP instead of local
  const handleGainXP = (amount: number, reason: string) => {
      addXP(amount, reason);
  };

  // --- TASK MANAGEMENT (Enhanced for linking) ---
  const handleAddTask = (content: string, desc: string, priority: 1|2|3|4, dueDate: string|null, feature?: string) => {
      const newTask: TodoTask = {
          id: Date.now().toString(),
          content: content,
          description: desc,
          priority: priority,
          dueDate: dueDate,
          projectId: 'inbox',
          isCompleted: false,
          tags: [],
          subtasks: [],
          status: 'todo',
          startDate: new Date().toISOString().split('T')[0],
          linkedFeature: feature // Link to current feature
      };
      setTasks(prev => [...prev, newTask]);
      addXP(10, "Tạo công việc mới");
      logAction('create_content', 'Todo', `Added Task: ${content}`);
  };

  const handleToggleTask = (id: string) => {
      setTasks(prev => prev.map(t => {
          if (t.id === id) {
              const completed = !t.isCompleted;
              if (completed) {
                  addXP(50, `Hoàn thành: ${t.content}`);
                  logAction('complete_task', 'Todo', `Completed Task: ${t.content}`);
              }
              return { ...t, isCompleted: completed, completedAt: completed ? new Date().toISOString() : undefined };
          }
          return t;
      }));
  };

  const handleCategorySelect = (tag: string) => { 
      if (tag === '') {
          setActiveTagFilter(null);
      } else {
          setActiveTagFilter(tag); 
      }
      setView('explore-graph'); 
      window.scrollTo({ top: 0, behavior: 'smooth' }); 
  };
  
  const handleExpandNode = (nodeTitle: string) => { 
      handleNavigateToAlchemy({ type: 'expand', initialQuery: nodeTitle });
  };

  const handleAskTutor = (node: KnowledgeNode) => { setTutorContextNode(node); setTutorContext(`Hãy giải thích chi tiết về "${node.title}".`); setView('tutor'); window.scrollTo({ top: 0, behavior: 'smooth' }); };
  const handleCreateNoteFromChat = (content: string) => { 
      handleNavigateToAlchemy({ type: 'create', initialQuery: content });
  };
  const handleAnalyzeImageInTutor = async (imageBase64: string) => {
      setTutorContext("Hãy phân tích hình ảnh này giúp tôi.");
      const analysis = await analyzeImageForDiscussion(imageBase64, "Describe this image in detail for educational purposes.");
      setTutorContext(`[Hệ thống: Người dùng đã gửi một ảnh]\n\nPhân tích sơ bộ từ AI: ${analysis}\n\nHãy giúp người dùng tìm hiểu sâu hơn về hình ảnh này.`);
      setView('tutor');
      window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  const handleDigestImageContent = (content: string) => { console.log(content); setView('digest'); window.scrollTo({ top: 0, behavior: 'smooth' }); };
  const handleExplodeToFlashcards = (content: string) => { 
      handleNavigateToAlchemy({ type: 'create', initialQuery: content });
  };
  const handleSaveChatAsNode = (node: KnowledgeNode) => { 
      setUserNodes(prev => [...prev, node]); 
      logAction('create_content', 'Tutor', `Saved Case Study: ${node.title}`);
  };

  // --- SYNC: View Switchers ---
  const handleExploreGraph = () => { setView('explore-graph'); window.scrollTo({ top: 0, behavior: 'smooth' }); };
  const handleExploreSearch = () => { setView('explore-search'); window.scrollTo({ top: 0, behavior: 'smooth' }); };
  const handleExploreCategory = () => { setView('explore-category'); window.scrollTo({ top: 0, behavior: 'smooth' }); };
  const handleExploreTopic = () => { setView('explore-topic'); window.scrollTo({ top: 0, behavior: 'smooth' }); };
  const handleExploreDifficulty = () => { setView('explore-difficulty'); window.scrollTo({ top: 0, behavior: 'smooth' }); };
  const handleExploreSkill = () => { setView('explore-skill'); window.scrollTo({ top: 0, behavior: 'smooth' }); };

  const handleNodeClick = (node: KnowledgeNode) => { 
      setSelectedNode(node); 
      setLearningQueue([]); 
      setCurrentPlaylistIndex(0); 
      setFocusedNodeId(node.id);
      logAction('click_element', 'Graph', `Viewed node: ${node.title}`);
  };
  
  const handleDeepDive = (context: string) => { setTutorContext(context); setTutorContextNode(selectedNode); setSelectedNode(null); setView('tutor'); window.scrollTo({ top: 0, behavior: 'smooth' }); };

  const handleStartPlaylist = (nodes: KnowledgeNode[]) => { 
      if (nodes.length === 0) return; 
      setLearningQueue(nodes); 
      setCurrentPlaylistIndex(0); 
      setSelectedNode(nodes[0]); 
      logAction('view_feature', 'Playlist', `Started playlist with ${nodes.length} items`);
  };

  const handleNextNode = () => {
      // Award XP for finishing a node
      addXP(20, "Hoàn thành bài học");
      
      if (currentPlaylistIndex < learningQueue.length - 1) {
          const nextIndex = currentPlaylistIndex + 1;
          setCurrentPlaylistIndex(nextIndex);
          setSelectedNode(learningQueue[nextIndex]);
      } else {
          setSelectedNode(null);
          setLearningQueue([]);
          addXP(50, "Hoàn thành Playlist"); // Bonus for finishing list
          logAction('complete_task', 'Playlist', 'Finished all items');
      }
  };

  const handleMergeNodes = (nodesToMerge: KnowledgeNode[]) => {
      if (nodesToMerge.length < 2) return;
      const mergedTitle = `Tổng hợp: ${nodesToMerge[0].title} & ${nodesToMerge.length - 1} khác`;
      const mergedData: KnowledgeNode['data'] = {
          flashcards: nodesToMerge.flatMap(n => n.data?.flashcards || []),
          quiz: nodesToMerge.flatMap(n => n.data?.quiz || []),
          fillInBlanks: nodesToMerge.flatMap(n => n.data?.fillInBlanks || []),
          spotErrors: nodesToMerge.flatMap(n => n.data?.spotErrors || []),
          caseStudies: nodesToMerge.flatMap(n => n.data?.caseStudies || []),
          summary: nodesToMerge.map(n => n.data?.summary).filter(Boolean).join('\n\n---\n\n')
      };
      const newNode: KnowledgeNode = {
          id: Date.now().toString(),
          title: mergedTitle,
          type: 'Mixed',
          status: 'new',
          tags: Array.from(new Set(nodesToMerge.flatMap(n => n.tags || []))),
          x: nodesToMerge.reduce((sum, n) => sum + n.x, 0) / nodesToMerge.length,
          y: nodesToMerge.reduce((sum, n) => sum + n.y, 0) / nodesToMerge.length,
          timestamp: new Date(),
          data: mergedData,
          imageUrl: nodesToMerge[0].imageUrl
      };
      setUserNodes(prev => [...prev, newNode]);
      alert(`Đã hợp nhất ${nodesToMerge.length} bài học thành công!`);
  };

  const handleDeleteNodes = (nodes: KnowledgeNode[]) => {
      if (window.confirm("Xóa các nốt này?")) {
          const ids = new Set(nodes.map(n => n.id));
          setUserNodes(prev => prev.filter(n => !ids.has(n.id)));
      }
  };
  const handleDeleteNode = (node: KnowledgeNode) => handleDeleteNodes([node]);

  const showGlobalNav = !['dashboard', 'landing', 'alchemy', 'knowledge-graph', 'tutor', 'media', 'drive', 'digest', 'video', 'community', 'battle', 'explore-graph', 'explore-search', 'explore-category', 'draw', 'drawing-manager', 'achievements'].includes(view);

  // Drawing Handlers
  const handleOpenDrawing = (drawing: SavedDrawing) => {
      setCurrentDrawing(drawing);
      setView('draw');
  };

  // Nav Handler for Todo Links
  const handleTodoNavigate = (targetView: string) => {
      if (targetView === 'digest') {
          setView('digest');
      } else {
          handleFeatureSelect(targetView);
      }
      setIsTodoPanelOpen(false);
  };

  // Global Todo Toggle
  const toggleTodoPanel = () => setIsTodoPanelOpen(!isTodoPanelOpen);

  return (
    <div className={`flex flex-col min-h-screen font-display ${showGlobalNav ? 'bg-[#F8F9FA] dark:bg-[#101c22]' : ''}`}>
      {/* THE NEURAL FEEDBACK WIDGET */}
      {isLoggedIn && <NeuralFeedbackWidget />}
      
      {showGlobalNav && (
        <Header 
            onStart={handleStart} 
            onLoginClick={handleLoginClick} 
            isAppView={view !== 'landing'} 
            onShowAbout={handleShowAbout} 
            onShowFAQ={handleShowFAQ} 
            onGoToDashboard={handleGoBackToDashboard} 
            onGoToFeatures={handleGoToFeatures} 
            onShowFriends={() => setIsFriendManagerOpen(true)}
            onToggleTodo={toggleTodoPanel}
        />
      )}
      
      <LoginModal isOpen={isLoginModalOpen} onClose={handleCloseModal} onLoginSuccess={handleLoginSuccess} />
      
      {/* Global Modals */}
      <FriendManager isOpen={isFriendManagerOpen} onClose={() => setIsFriendManagerOpen(false)} />
      <GlobalTodoPanel 
        isOpen={isTodoPanelOpen} 
        onClose={() => setIsTodoPanelOpen(false)} 
        tasks={tasks}
        onAddTask={handleAddTask}
        onToggleTask={(id) => handleToggleTask(id)}
        currentView={view}
        onNavigate={handleTodoNavigate}
      />
      
      {selectedNode && <LearningModal key={selectedNode.id} node={selectedNode} onClose={() => setSelectedNode(null)} onUpdateNode={handleUpdateNode} onDeepDive={handleDeepDive} playlistTotal={learningQueue.length > 0 ? learningQueue.length : undefined} playlistCurrent={learningQueue.length > 0 ? currentPlaylistIndex + 1 : undefined} onNextNode={learningQueue.length > 0 && currentPlaylistIndex < learningQueue.length - 1 ? handleNextNode : undefined} />}

      <main className="flex-grow">
        {view === 'landing' && <><Hero onStart={handleStart} /><Features /><Testimonials /><CallToAction onStart={handleStart} /></>}
        
        {view === 'dashboard' && <Dashboard onLogout={handleLogout} onFeatureSelect={handleFeatureSelect} onShowAbout={handleShowAbout} onShowFAQ={handleShowFAQ} onShowAccount={handleShowAccount} stats={stats} scrollToFeatures={scrollToFeatures} onScrollComplete={() => setScrollToFeatures(false)} />}
        
        {view === 'achievements' && <AchievementGallery onBack={handleGoBackToDashboard} userNodes={userNodes} />}

        {view === 'account' && <Account onBack={handleGoBackToDashboard} onLogout={handleLogout} onShowAbout={handleShowAbout} onShowFAQ={handleShowFAQ} onGoToFeatures={handleGoToFeatures} />}
        
        {/* Pass onToggleTodo and onNavigateToFeature to SocraticTutor */}
        {view === 'tutor' && <SocraticTutor 
            onBack={handleGoBackToDashboard} 
            onShowAbout={handleShowAbout} 
            onLogout={handleLogout} 
            onShowFAQ={handleShowFAQ} 
            onShowAccount={handleShowAccount} 
            initialMessage={tutorContext} 
            contextNode={tutorContextNode} 
            userNodes={userNodes} 
            stats={stats} 
            onSaveToAlchemy={handleCreateNoteFromChat} 
            onSaveCaseStudy={handleSaveChatAsNode} 
            onUpdateNode={handleUpdateNode} 
            onToggleTodo={toggleTodoPanel} 
            onNavigateToFeature={handleFeatureSelect}
        />}
        
        {view === 'alchemy' && <Alchemy onBack={handleGoBackToDashboard} onShowAbout={handleShowAbout} onLogout={handleLogout} onShowFAQ={handleShowFAQ} onShowAccount={handleShowAccount} onAddNode={handleAddNode} onGoToGraph={() => handleFeatureSelect('explore-graph')} userNodes={userNodes} onUpdateNode={handleUpdateNode} onNavigateToDistill={() => handleFeatureSelect('video')} intent={alchemyIntent} onGoToFeatures={handleGoToFeatures} onGoToBattle={() => setView('battle')} onToggleTodo={toggleTodoPanel} />}
        
        {view === 'explore-graph' && <ExploreGraph 
            onBack={handleGoBackToDashboard} 
            onShowAbout={handleShowAbout} 
            onSearch={handleExploreSearch} 
            onCategory={handleExploreCategory} 
            onLogout={handleLogout} 
            onShowFAQ={handleShowFAQ} 
            onShowAccount={handleShowAccount} 
            userNodes={userNodes} 
            onNodeClick={handleNodeClick} 
            onStartPlaylist={handleStartPlaylist} 
            onMergeNodes={handleMergeNodes} 
            onDeleteNodes={handleDeleteNodes} 
            activeFilter={activeTagFilter} 
            onClearFilter={() => setActiveTagFilter(null)} 
            onExpandNode={handleExpandNode} 
            onAskTutor={handleAskTutor} 
            focusedNodeId={focusedNodeId} 
            onNavigateToAlchemy={handleNavigateToAlchemy} 
            quests={quests}
            userXP={progress.xp}
            userLevel={progress.level}
            currentAchievement={activeAchievement}
            onClaimReward={handleClaimQuest}
            onCloseAchievement={() => setActiveAchievement(null)}
            onGainXP={handleGainXP} 
            onRegisterQuest={handleRegisterQuest}
            onAddTask={handleAddTask}
            onGoToFeatures={handleGoToFeatures}
            onToggleTodo={toggleTodoPanel}
        />}
        
        {view === 'explore-search' && <ExploreSearch onBack={handleExploreGraph} onShowAbout={handleShowAbout} onLogout={handleLogout} onShowFAQ={handleShowFAQ} onShowAccount={handleShowAccount} onGoToFeatures={handleGoToFeatures} />}
        
        {view === 'explore-category' && <ExploreCategory onBack={handleGoBackToDashboard} onShowAbout={handleShowAbout} onTopicSelect={handleCategorySelect} onDifficultySelect={handleExploreDifficulty} onSkillSelect={handleExploreSkill} onLogout={handleLogout} onShowFAQ={handleShowFAQ} onShowAccount={handleShowAccount} userNodes={userNodes} onGoToFeatures={handleGoToFeatures} />}
        
        {view === 'knowledge-graph' && <KnowledgeGraph onBack={handleGoBackToDashboard} onShowAbout={handleShowAbout} onExplore={handleExploreGraph} onLogout={handleLogout} onShowFAQ={handleShowFAQ} onShowAccount={handleShowAccount} userNodes={userNodes} onNodeClick={handleNodeClick} onDeleteNode={handleDeleteNode} onGoToFeatures={handleGoToFeatures} />}
        {view === 'explore-topic' && <ExploreTopic onBack={handleExploreCategory} onShowAbout={handleShowAbout} onLogout={handleLogout} onShowFAQ={handleShowFAQ} onShowAccount={handleShowAccount} onGoToFeatures={handleGoToFeatures} />}
        {view === 'explore-difficulty' && <ExploreDifficulty onBack={handleExploreCategory} onShowAbout={handleShowAbout} onLogout={handleLogout} onShowFAQ={handleShowFAQ} onShowAccount={handleShowAccount} onGoToFeatures={handleGoToFeatures} />}
        {view === 'explore-skill' && <ExploreSkill onBack={handleExploreCategory} onShowAbout={handleShowAbout} onLogout={handleLogout} onShowFAQ={handleShowFAQ} onShowAccount={handleShowAccount} onGoToFeatures={handleGoToFeatures} />}
        
        {view === 'media' && <NoteTaking onBack={handleGoBackToDashboard} onShowAbout={handleShowAbout} onLogout={handleLogout} onShowFAQ={handleShowFAQ} onShowAccount={handleShowAccount} onAnalyzeNote={handleCreateNoteFromChat} onToggleTodo={toggleTodoPanel} onNavigateToFeature={handleFeatureSelect} />}
        
        {/* REPLACED CRAM MODE WITH DRIVE STORAGE */}
        {view === 'drive' && <DriveStorage onBack={handleGoBackToDashboard} onShowAccount={handleShowAccount} onNavigateToAlchemy={handleNavigateToAlchemy} onToggleTodo={toggleTodoPanel} />}
        
        {view === 'digest' && <ThingsToDo onBack={handleGoBackToDashboard} onShowAbout={handleShowAbout} onLogout={handleLogout} onShowFAQ={handleShowFAQ} onShowAccount={handleShowAccount} />}
        
        {view === 'video' && <VideoCourse onBack={handleGoBackToDashboard} onShowAbout={handleShowAbout} onLogout={handleLogout} onShowFAQ={handleShowFAQ} onShowAccount={handleShowAccount} onAddNodes={handleAddNodes} onRegisterQuest={handleRegisterQuest} onToggleTodo={toggleTodoPanel} />}
        
        {view === 'community' && <Community onBack={handleGoBackToDashboard} onShowAbout={handleShowAbout} onLogout={handleLogout} onShowFAQ={handleShowFAQ} onShowAccount={handleShowAccount} userNodes={userNodes} onUpdateNode={handleUpdateNode} onGoToBattle={() => setView('battle')} onToggleTodo={toggleTodoPanel} />}
        {view === 'battle' && <LearnWithPeople onBack={() => setView('community')} userNodes={userNodes} />}
        
        {view === 'drawing-manager' && <DrawingManager onBack={handleGoBackToDashboard} onOpenDrawing={handleOpenDrawing} onShowAccount={handleShowAccount} onLogout={handleLogout} onNavigateToFeature={handleFeatureSelect} />}
        {/* Pass onNavigateToFeature to DrawEverything */}
        {view === 'draw' && currentDrawing && <DrawEverything 
            onBack={() => setView('drawing-manager')} 
            onShowAbout={handleShowAbout} 
            onLogout={handleLogout} 
            onShowFAQ={handleShowFAQ} 
            onShowAccount={handleShowAccount} 
            initialDrawing={currentDrawing} 
            onToggleTodo={toggleTodoPanel} 
            onAddNode={handleAddNode} 
            onNavigateToAlchemy={handleNavigateToAlchemy} 
            onNavigateToFeature={handleFeatureSelect}
        />}
        
        {/* Static Pages */}
        {view === 'about' && <About onBack={handleBackFromAbout} onShowVision={handleShowVision} onShowMission={handleShowMission} onShowStory={handleShowStory} onShowTeam={handleShowTeam} onShowContact={handleShowContact} onLogout={handleLogout} onShowFAQ={handleShowFAQ} onShowAccount={handleShowAccount} onGoToFeatures={handleGoToFeatures} />}
        {view === 'vision' && <Vision onBack={handleShowAbout} onLogout={handleLogout} onShowFAQ={handleShowFAQ} onShowAccount={handleShowAccount} onGoToFeatures={handleGoToFeatures} />}
        {view === 'mission' && <Mission onBack={handleShowAbout} onLogout={handleLogout} onShowFAQ={handleShowFAQ} onShowAccount={handleShowAccount} onGoToFeatures={handleGoToFeatures} />}
        {view === 'story' && <Story onBack={handleShowAbout} onLogout={handleLogout} onShowFAQ={handleShowFAQ} onShowAccount={handleShowAccount} onGoToFeatures={handleGoToFeatures} />}
        {view === 'team' && <Team onBack={handleShowAbout} onLogout={handleLogout} onShowFAQ={handleShowFAQ} onShowAccount={handleShowAccount} onGoToFeatures={handleGoToFeatures} />}
        {view === 'contact' && <Contact onBack={handleShowAbout} onLogout={handleLogout} onShowFAQ={handleShowFAQ} onShowAccount={handleShowAccount} onGoToFeatures={handleGoToFeatures} />}
        {view === 'faq' && <FAQ onBack={handleBackFromFAQ} onLogout={handleLogout} onShowAbout={handleShowAbout} onShowAccount={handleShowAccount} onGoToFeatures={handleGoToFeatures} />}
      </main>
      
      {showGlobalNav && <Footer />}
    </div>
  );
}

export default App;

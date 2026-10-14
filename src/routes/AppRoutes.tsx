import { lazy, Suspense } from "react";
import { Navigate, Outlet, Route, Routes, useLocation } from "react-router-dom";
import { VoiceProvider } from "../voice/VoiceContext";
import { MainLayout } from "../layouts/MainLayout";

// Every page is its own chunk, loaded on first visit.
const Home = lazy(() => import("../pages/Home"));
const Grammar = lazy(() => import("../pages/Grammar"));
const GrammarTopic = lazy(() => import("../pages/Grammar/GrammarTopic"));
const GrammarLesson = lazy(() => import("../pages/Grammar/GrammarLesson"));
const Vocabulary = lazy(() => import("../pages/Vocabulary"));
const VocabularyDetail = lazy(() => import("../pages/Vocabulary/VocabularyDetail"));
const SpokenEnglish = lazy(() => import("../pages/SpokenEnglish"));
const SpokenLesson = lazy(() => import("../pages/SpokenEnglish/SpokenLesson"));
const Quiz = lazy(() => import("../pages/Quiz"));
const QuizCategory = lazy(() => import("../pages/Quiz/QuizCategory"));
const QuizPlay = lazy(() => import("../pages/Quiz/QuizPlay"));
const Courses = lazy(() => import("../pages/Courses"));
const CourseDetail = lazy(() => import("../pages/Courses/CourseDetail"));
const Blog = lazy(() => import("../pages/Blog"));
const BlogDetail = lazy(() => import("../pages/Blog/BlogDetail"));
const Contact = lazy(() => import("../pages/Contact"));
const SearchPage = lazy(() => import("../pages/Search"));
const Login = lazy(() => import("../pages/Auth/Login"));
const Register = lazy(() => import("../pages/Auth/Register"));
const NotFound = lazy(() => import("../pages/NotFound"));
const PaymentStatus = lazy(() => import("../pages/Payment/PaymentStatus"));
const AdminApp = lazy(() => import("../admin/AdminApp"));
const PortalApp = lazy(() => import("../portal/PortalApp"));

/** Old addresses of pages that moved into the learner portal (keeps ?room= invite links working). */
function MovedTo({ to }: { to: string }) {
  const { search } = useLocation();
  return <Navigate to={`${to}${search}`} replace />;
}

export function AppRoutes() {
  return (
    <Routes>
      <Route path="admin/*" element={<Suspense fallback={null}><AdminApp /></Suspense>} />
      {/* One voice-chat connection for the website and the learner portal, so a call carries on between them. */}
      <Route element={<VoiceProvider><Outlet /></VoiceProvider>}>
      <Route path="learn/*" element={<Suspense fallback={null}><PortalApp /></Suspense>} />
      <Route element={<MainLayout />}>
        <Route index element={<Home />} />
        <Route path="grammar" element={<Grammar />} />
        <Route path="grammar/:topic" element={<GrammarTopic />} />
        <Route path="grammar/:topic/:lesson" element={<GrammarLesson />} />
        <Route path="vocabulary" element={<Vocabulary />} />
        <Route path="vocabulary/:word" element={<VocabularyDetail />} />
        <Route path="spoken-english" element={<SpokenEnglish />} />
        <Route path="spoken-english/:lesson" element={<SpokenLesson />} />
        <Route path="quiz" element={<Quiz />} />
        <Route path="quiz/:category" element={<QuizCategory />} />
        <Route path="quiz/:category/:quizId" element={<QuizPlay />} />
        <Route path="courses" element={<Courses />} />
        <Route path="courses/:courseId" element={<CourseDetail />} />
        <Route path="blog" element={<Blog />} />
        <Route path="blog/:slug" element={<BlogDetail />} />
        <Route path="contact" element={<Contact />} />
        <Route path="dashboard" element={<MovedTo to="/learn" />} />
        <Route path="speak" element={<MovedTo to="/learn/live" />} />
        <Route path="search" element={<SearchPage />} />
        <Route path="login" element={<Login />} />
        <Route path="register" element={<Register />} />
        <Route path="payment/status" element={<PaymentStatus />} />
        <Route path="*" element={<NotFound />} />
      </Route>
      </Route>
    </Routes>
  );
}

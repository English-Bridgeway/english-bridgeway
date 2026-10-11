import { lazy, Suspense } from "react";
import { Route, Routes } from "react-router-dom";
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
const Dashboard = lazy(() => import("../pages/Dashboard"));
const SearchPage = lazy(() => import("../pages/Search"));
const Login = lazy(() => import("../pages/Auth/Login"));
const Register = lazy(() => import("../pages/Auth/Register"));
const NotFound = lazy(() => import("../pages/NotFound"));
const PaymentStatus = lazy(() => import("../pages/Payment/PaymentStatus"));
const AdminApp = lazy(() => import("../admin/AdminApp"));

export function AppRoutes() {
  return (
    <Routes>
      <Route path="admin/*" element={<Suspense fallback={null}><AdminApp /></Suspense>} />
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
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="search" element={<SearchPage />} />
        <Route path="login" element={<Login />} />
        <Route path="register" element={<Register />} />
        <Route path="payment/status" element={<PaymentStatus />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}

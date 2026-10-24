import { lazy } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { RequireAuth } from "../components/RequireAuth";
import { PortalLayout } from "./PortalLayout";

const Overview = lazy(() => import("../pages/Dashboard"));
const MyCourses = lazy(() => import("./pages/MyCourses"));
const CoursePlayer = lazy(() => import("./pages/CoursePlayer"));
const SpeakAI = lazy(() => import("./pages/SpeakAI"));
const SpeakLive = lazy(() => import("../pages/SpeakLive"));
const Profile = lazy(() => import("./pages/Profile"));
const Billing = lazy(() => import("./pages/Billing"));
const Ebooks = lazy(() => import("./pages/Ebooks"));

/** The learner portal at /learn, for signed-in learners only. */
export default function PortalApp() {
  return (
    <RequireAuth>
        <PortalLayout>
          <Routes>
            <Route index element={<Overview />} />
            <Route path="courses" element={<MyCourses />} />
            <Route path="courses/:courseId" element={<CoursePlayer />} />
            <Route path="ebooks" element={<Ebooks />} />
            <Route path="ai" element={<SpeakAI />} />
            <Route path="live" element={<SpeakLive />} />
            <Route path="profile" element={<Profile />} />
            <Route path="billing" element={<Billing />} />
            <Route path="*" element={<Navigate to="/learn" replace />} />
          </Routes>
        </PortalLayout>
    </RequireAuth>
  );
}

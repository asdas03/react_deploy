import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LogOut, Loader2, FileText, PenTool, BookOpen, Lightbulb } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import schoolLogo from "@/assets/school-logo.png";
import sogangLogo from "@/assets/sogang-logo.png";
import seoulLogo from "@/assets/seoul-logo.png";
import koreaLogo from "@/assets/korea-logo.png";
import yonseiLogo from "@/assets/yonsei-logo.png";
import gradeDreamLogo from "@/assets/grade-dream-logo.png";

const Menu = () => {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<{ name: string; student_id: string; school: string } | null>(null);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    // Check authentication and load profile
    const loadUserData = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (session) {
        setUser(session.user);

        // Fetch profile data
        const { data: profileData, error } = await supabase
          .from("profiles")
          .select("name, student_id, school")
          .eq("user_id", session.user.id)
          .maybeSingle();

        if (error) {
          console.error("프로필 로드 실패:", error);
        } else if (profileData) {
          setProfile(profileData);
        }
      }

      setLoading(false);
    };

    loadUserData();

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null);
      if (session) {
        loadUserData();
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  const getUniversityLogo = (school: string) => {
    if (school.includes("서강대")) return sogangLogo;
    if (school.includes("서울대")) return seoulLogo;
    if (school.includes("고려대")) return koreaLogo;
    if (school.includes("연세대")) return yonseiLogo;
    return schoolLogo;
  };

  const handleSignOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      toast({
        title: "로그아웃 실패",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      <div className="container mx-auto p-4 max-w-6xl">
        <div className="flex justify-between items-start mb-4">
          <div className="flex items-start gap-4">
            {profile && user && (
              <>
                <img src={getUniversityLogo(profile.school)} alt="School Logo" className="w-24 h-24 object-contain" />
                <div className="flex flex-col justify-center space-y-1">
                  <p className="text-lg font-bold text-foreground">{profile.school}</p>
                  <p className="text-base text-muted-foreground">{profile.student_id}</p>
                  <p className="text-base text-foreground">{profile.name}</p>
                </div>
              </>
            )}
          </div>
          <div className="flex gap-2">
            {user ? (
              <Button variant="outline" onClick={handleSignOut} className="gap-2">
                <LogOut className="w-4 h-4" />
                로그아웃
              </Button>
            ) : (
              <>
                <Button variant="outline" onClick={() => navigate("/auth?mode=login")}>
                  로그인
                </Button>
                <Button onClick={() => navigate("/auth?mode=signup")}>회원가입</Button>
              </>
            )}
          </div>
        </div>

        <div className="flex items-center justify-center min-h-[calc(100vh-100px)]">
          <div className="w-full max-w-4xl">
            <div className="text-center mb-8">
              <img src={gradeDreamLogo} alt="Grade Dream" className="mx-auto h-64 mb-2" />
              <p className="text-muted-foreground">원하는 기능을 선택하세요</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <Card
                className="hover:shadow-lg transition-shadow cursor-pointer"
                onClick={() => navigate("/problem-solving")}
              >
                <CardHeader className="text-center">
                  <div className="mx-auto w-16 h-16 rounded-full bg-gradient-to-br from-green-400 to-green-600 flex items-center justify-center mb-4">
                    <PenTool className="w-8 h-8 text-white" />
                  </div>
                  <CardTitle>문제풀이</CardTitle>
                  <CardDescription>PDF를 업로드하여 문제를 풀어보세요</CardDescription>
                </CardHeader>
                <CardContent>
                  <Button className="w-full">시작하기</Button>
                </CardContent>
              </Card>

              <Card
                className="hover:shadow-lg transition-shadow cursor-pointer"
                onClick={() => navigate("/pdf-upload")}
              >
                <CardHeader className="text-center">
                  <div className="mx-auto w-16 h-16 rounded-full bg-gradient-to-br from-blue-400 to-purple-600 flex items-center justify-center mb-4">
                    <FileText className="w-8 h-8 text-white" />
                  </div>
                  <CardTitle>문제 만들기</CardTitle>
                  <CardDescription>PDF를 업로드하여 문제를 생성하세요</CardDescription>
                </CardHeader>
                <CardContent>
                  <Button className="w-full">시작하기</Button>
                </CardContent>
              </Card>

              <Card
                className="hover:shadow-lg transition-shadow cursor-pointer"
                onClick={() => navigate("/wrong-answers")}
              >
                <CardHeader className="text-center">
                  <div className="mx-auto w-16 h-16 rounded-full bg-gradient-to-br from-orange-400 to-red-600 flex items-center justify-center mb-4">
                    <BookOpen className="w-8 h-8 text-white" />
                  </div>
                  <CardTitle>오답노트 및 즐겨찾기</CardTitle>
                  <CardDescription>틀린 문제와 즐겨찾기한 문제를 복습하세요</CardDescription>
                </CardHeader>
                <CardContent>
                  <Button className="w-full">시작하기</Button>
                </CardContent>
              </Card>

              <Card
                className="hover:shadow-lg transition-shadow cursor-pointer"
                onClick={() => navigate("/recommended-problems")}
              >
                <CardHeader className="text-center">
                  <div className="mx-auto w-16 h-16 rounded-full bg-gradient-to-br from-yellow-400 to-amber-600 flex items-center justify-center mb-4">
                    <Lightbulb className="w-8 h-8 text-white" />
                  </div>
                  <CardTitle>추천 문제 풀기</CardTitle>
                  <CardDescription>약점을 분석하여 맞춤 문제를 추천합니다</CardDescription>
                </CardHeader>
                <CardContent>
                  <Button className="w-full">시작하기</Button>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Menu;

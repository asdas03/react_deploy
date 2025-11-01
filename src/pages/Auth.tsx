import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Loader2, ArrowLeft } from "lucide-react";

const Auth = () => {
  const [searchParams] = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [studentId, setStudentId] = useState("");
  const [school, setSchool] = useState("");
  const [loading, setLoading] = useState(false);
  const [isSignUp, setIsSignUp] = useState(searchParams.get('mode') === 'signup');
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    // Check if user is already logged in
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        navigate("/");
      }
    });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (session) {
        navigate("/");
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/`,
          data: {
            name,
            school,
            student_id: studentId,
          },
        },
      });

      if (error) {
        if (error.message.includes("already registered")) {
          toast({
            title: "이미 가입된 이메일",
            description: "이 이메일은 이미 등록되어 있습니다. 로그인해주세요.",
            variant: "destructive",
          });
        } else {
          toast({
            title: "회원가입 실패",
            description: error.message,
            variant: "destructive",
          });
        }
      } else if (data.user) {
        toast({
          title: "회원가입 성공",
          description: "환영합니다!",
        });
      }
    } catch (error) {
      toast({
        title: "오류 발생",
        description: "회원가입 중 문제가 발생했습니다.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        if (error.message.includes("Invalid login credentials")) {
          toast({
            title: "로그인 실패",
            description: "이메일 또는 비밀번호가 올바르지 않습니다.",
            variant: "destructive",
          });
        } else {
          toast({
            title: "로그인 실패",
            description: error.message,
            variant: "destructive",
          });
        }
      } else {
        toast({
          title: "로그인 성공",
          description: "환영합니다!",
        });
      }
    } catch (error) {
      toast({
        title: "오류 발생",
        description: "로그인 중 문제가 발생했습니다.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden p-4">
      {/* Radial gradient background */}
      <div className="absolute inset-0 bg-gradient-to-br from-blue-50 via-white to-blue-50">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-blue-300/30 rounded-full blur-3xl" />
      </div>

      {/* Back button */}
      <Button
        variant="ghost"
        size="icon"
        onClick={() => navigate('/')}
        className="absolute top-4 left-4 z-10 text-gray-600 hover:text-gray-900"
      >
        <ArrowLeft className="h-6 w-6" />
      </Button>

      {/* Login card */}
      <div className="relative w-full max-w-sm">
        <div className="bg-gradient-to-br from-blue-400 to-blue-500 rounded-3xl shadow-2xl shadow-blue-500/50 p-8">
          <h1 className="text-white text-3xl font-bold text-center mb-2">
            {isSignUp ? "회원가입" : "로그인"}
          </h1>
          <p className="text-white/80 text-sm text-center mb-8">
            {isSignUp ? "새 계정을 만들어주세요" : "계정에 로그인하세요"}
          </p>

          <form onSubmit={isSignUp ? handleSignUp : handleSignIn} className="space-y-4">
            {isSignUp && (
              <>
                <Select value={school} onValueChange={setSchool} disabled={loading} required>
                  <SelectTrigger className="bg-white border-0 h-12 text-gray-700">
                    <SelectValue placeholder="학교 선택" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="서강대학교">서강대학교</SelectItem>
                    <SelectItem value="서울대학교">서울대학교</SelectItem>
                    <SelectItem value="고려대학교">고려대학교</SelectItem>
                    <SelectItem value="연세대학교">연세대학교</SelectItem>
                  </SelectContent>
                </Select>

                <Input
                  type="text"
                  placeholder="학번"
                  value={studentId}
                  onChange={(e) => setStudentId(e.target.value)}
                  required
                  disabled={loading}
                  className="bg-white border-0 h-12 text-gray-700 placeholder:text-gray-400"
                />

                <Input
                  type="text"
                  placeholder="이름"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  disabled={loading}
                  className="bg-white border-0 h-12 text-gray-700 placeholder:text-gray-400"
                />
              </>
            )}

            <Input
              type="email"
              placeholder="이메일"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={loading}
              className="bg-white border-0 h-12 text-gray-700 placeholder:text-gray-400"
            />

            <Input
              type="password"
              placeholder="비밀번호"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={loading}
              minLength={6}
              className="bg-white border-0 h-12 text-gray-700 placeholder:text-gray-400"
            />

            <Button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white h-12 rounded-full font-semibold mt-6"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {isSignUp ? "가입 중..." : "로그인 중..."}
                </>
              ) : isSignUp ? (
                "회원가입"
              ) : (
                "로그인"
              )}
            </Button>
          </form>

          <button
            onClick={() => setIsSignUp(!isSignUp)}
            className="w-full text-center text-white/90 text-sm mt-6 hover:text-black transition-colors underline"
            disabled={loading}
          >
            {isSignUp ? "이미 계정이 있으신가요? 로그인하기" : "계정이 없으신가요? 회원가입하기"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default Auth;

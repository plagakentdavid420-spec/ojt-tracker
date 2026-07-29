'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

export default function DashboardPage() {
  const router = useRouter()
  const supabase = createClient()

  const [loading, setLoading] = useState(true)
  const [profile, setProfile] = useState<any>(null)
  
  // Student State
  const [attendanceLogs, setAttendanceLogs] = useState<any[]>([])
  const [tasksSummary, setTasksSummary] = useState('')
  const [hoursRendered, setHoursRendered] = useState('')
  const [activeLog, setActiveLog] = useState<any>(null)

  // Teacher/Supervisor State
  const [allReports, setAllReports] = useState<any[]>([])

  useEffect(() => {
    fetchUserProfile()
  }, [])

  const fetchUserProfile = async () => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      router.push('/login')
      return
    }

    // Fetch user profile to check role
    const { data: profileData } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single()

    setProfile(profileData)

    if (profileData?.role === 'student') {
      loadStudentData(user.id)
    } else {
      loadTeacherData()
    }

    setLoading(false)
  }

  // --- STUDENT FUNCTIONS ---
  const loadStudentData = async (studentId: string) => {
    // Get recent attendance logs
    const { data: logs } = await supabase
      .from('attendance_logs')
      .select('*')
      .eq('student_id', studentId)
      .order('created_at', { ascending: false })

    setAttendanceLogs(logs || [])

    // Check if currently clocked in (time_out is null)
    const ongoing = logs?.find((log) => log.time_out === null)
    setActiveLog(ongoing || null)
  }

  const handleClockIn = async () => {
    const { error } = await supabase.from('attendance_logs').insert([
      { student_id: profile.id, time_in: new Date().toISOString() },
    ])
    if (!error) loadStudentData(profile.id)
  }

  const handleClockOut = async () => {
    if (!activeLog) return
    const { error } = await supabase
      .from('attendance_logs')
      .update({ time_out: new Date().toISOString() })
      .eq('id', activeLog.id)

    if (!error) loadStudentData(profile.id)
  }

  const handleSubmitReport = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!tasksSummary || !hoursRendered) return

    const { error } = await supabase.from('daily_reports').insert([
      {
        student_id: profile.id,
        tasks_summary: tasksSummary,
        hours_rendered: parseFloat(hoursRendered),
      },
    ])

    if (!error) {
      alert('Daily report submitted successfully!')
      setTasksSummary('')
      setHoursRendered('')
    }
  }

  // --- TEACHER / SUPERVISOR FUNCTIONS ---
  const loadTeacherData = async () => {
    const { data: reports } = await supabase
      .from('daily_reports')
      .select(`
        id,
        date,
        tasks_summary,
        hours_rendered,
        is_approved,
        profiles ( full_name, company_name )
      `)
      .order('created_at', { ascending: false })

    setAllReports(reports || [])
  }

  const toggleApproval = async (reportId: string, currentStatus: boolean) => {
    const { error } = await supabase
      .from('daily_reports')
      .update({ is_approved: !currentStatus })
      .eq('id', reportId)

    if (!error) loadTeacherData()
  }

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  if (loading) {
    return <div className="flex h-screen items-center justify-center">Loading dashboard...</div>
  }

  return (
    <div className="min-h-screen bg-slate-50 p-6 dark:bg-slate-900">
      {/* Header */}
      <div className="mx-auto max-w-5xl flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Welcome, {profile?.full_name}</h1>
          <p className="text-sm text-slate-500 capitalize">Role: {profile?.role}</p>
        </div>
        <Button variant="outline" onClick={handleSignOut}>
          Sign Out
        </Button>
      </div>

      <div className="mx-auto max-w-5xl space-y-6">
        {/* ================= STUDENT VIEW ================= */}
        {profile?.role === 'student' && (
          <div className="grid gap-6 md:grid-cols-2">
            {/* Clock-in / Out Widget */}
            <Card>
              <CardHeader>
                <CardTitle>Daily Attendance (DTR)</CardTitle>
                <CardDescription>Log your daily arrival and departure time</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 text-center">
                <div className="py-4">
                  <span className="text-sm font-medium text-slate-500">Current Status: </span>
                  <span className={`font-semibold ${activeLog ? 'text-green-600' : 'text-slate-700'}`}>
                    {activeLog ? 'Clocked In' : 'Clocked Out'}
                  </span>
                </div>

                {activeLog ? (
                  <Button variant="destructive" className="w-full" onClick={handleClockOut}>
                    Clock Out Now
                  </Button>
                ) : (
                  <Button className="w-full bg-green-600 hover:bg-green-700" onClick={handleClockIn}>
                    Clock In Now
                  </Button>
                )}
              </CardContent>
            </Card>

            {/* Submit Daily Task Journal */}
            <Card>
              <CardHeader>
                <CardTitle>Submit Daily Journal</CardTitle>
                <CardDescription>Record rendered hours and activities</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmitReport} className="space-y-3">
                  <div>
                    <label className="text-sm font-medium">Tasks Accomplished</label>
                    <Input
                      placeholder="e.g. Fixed navigation bug, attended standup"
                      value={tasksSummary}
                      onChange={(e) => setTasksSummary(e.target.value)}
                      required
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium">Hours Rendered Today</label>
                    <Input
                      type="number"
                      step="0.5"
                      placeholder="e.g. 8"
                      value={hoursRendered}
                      onChange={(e) => setHoursRendered(e.target.value)}
                      required
                    />
                  </div>
                  <Button type="submit" className="w-full">
                    Submit Report
                  </Button>
                </form>
              </CardContent>
            </Card>
          </div>
        )}

        {/* ================= TEACHER / SUPERVISOR VIEW ================= */}
        {profile?.role !== 'student' && (
          <Card>
            <CardHeader>
              <CardTitle>Student Progress & Reports</CardTitle>
              <CardDescription>Review and approve daily reports submitted by students</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Student</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Tasks Summary</TableHead>
                    <TableHead>Hours</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {allReports.map((report) => (
                    <TableRow key={report.id}>
                      <TableCell className="font-medium">{report.profiles?.full_name}</TableCell>
                      <TableCell>{report.date}</TableCell>
                      <TableCell>{report.tasks_summary}</TableCell>
                      <TableCell>{report.hours_rendered} hrs</TableCell>
                      <TableCell>
                        <span className={`px-2 py-1 text-xs rounded ${report.is_approved ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                          {report.is_approved ? 'Approved' : 'Pending'}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Button
                          size="sm"
                          variant={report.is_approved ? 'outline' : 'default'}
                          onClick={() => toggleApproval(report.id, report.is_approved)}
                        >
                          {report.is_approved ? 'Unapprove' : 'Approve'}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {allReports.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-4 text-slate-500">
                        No student reports submitted yet.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
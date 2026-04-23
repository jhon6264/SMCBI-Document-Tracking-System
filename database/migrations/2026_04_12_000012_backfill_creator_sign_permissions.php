<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::table('session_members')
            ->where('role', 'session_admin')
            ->update([
                'can_sign' => true,
                'member_status' => DB::raw("CASE WHEN member_status = 'viewed' THEN 'pending' ELSE member_status END"),
            ]);
    }

    public function down(): void
    {
        DB::table('session_members')
            ->where('role', 'session_admin')
            ->where('member_status', 'pending')
            ->update([
                'can_sign' => false,
                'member_status' => 'viewed',
            ]);
    }
};

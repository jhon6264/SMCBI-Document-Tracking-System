<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('session_members', function (Blueprint $table) {
            $table->enum('invitation_status', ['pending', 'accepted', 'declined'])
                ->default('pending')
                ->after('member_status');
            $table->timestamp('invited_at')->nullable()->after('invitation_status');
            $table->timestamp('responded_at')->nullable()->after('invited_at');
        });

        DB::table('session_members')
            ->where('role', 'session_admin')
            ->update([
                'invitation_status' => 'accepted',
                'invited_at' => DB::raw('created_at'),
                'responded_at' => DB::raw('created_at'),
            ]);

        DB::table('session_members')
            ->where('role', '!=', 'session_admin')
            ->update([
                'invitation_status' => 'accepted',
                'invited_at' => DB::raw('created_at'),
                'responded_at' => DB::raw('created_at'),
            ]);
    }

    public function down(): void
    {
        Schema::table('session_members', function (Blueprint $table) {
            $table->dropColumn([
                'invitation_status',
                'invited_at',
                'responded_at',
            ]);
        });
    }
};

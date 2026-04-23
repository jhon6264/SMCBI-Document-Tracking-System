<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::statement(
            "ALTER TABLE `session_members` MODIFY `member_status` ENUM('waiting','pending','accepted','signed','viewed') NOT NULL DEFAULT 'waiting'"
        );
    }

    public function down(): void
    {
        DB::statement(
            "UPDATE `session_members` SET `member_status` = 'pending' WHERE `member_status` = 'accepted'"
        );

        DB::statement(
            "ALTER TABLE `session_members` MODIFY `member_status` ENUM('waiting','pending','signed','viewed') NOT NULL DEFAULT 'waiting'"
        );
    }
};

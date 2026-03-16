<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

class DepartmentSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        DB::table('departments')->insert([
            ['name' => 'Office', 'created_at' => now(), 'updated_at' => now()],
            ['name' => 'BSIT Department', 'created_at' => now(), 'updated_at' => now()],
            ['name' => 'BSBA Department', 'created_at' => now(), 'updated_at' => now()],
            ['name' => 'BSHM Department', 'created_at' => now(), 'updated_at' => now()],
            ['name' => 'BSED Department', 'created_at' => now(), 'updated_at' => now()],
            ['name' => 'BEED Department', 'created_at' => now(), 'updated_at' => now()],
        ]);
    }
}
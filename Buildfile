$s = Process.clock_gettime(Process::CLOCK_MONOTONIC)

$LOAD_PATH.unshift File.expand_path("./src/ruby", File.dirname(__FILE__))

require 'build_plan'

require 'actions/index'

HOST = ENV.fetch("HOST", "http://localhost:4001")

DIGEST_FILE = File.expand_path(".digests.json", File.dirname(__FILE__))

LAYOUT_FILE = "src/erb/_layout.html.erb"

SRC_FILES = Dir["src/ruby/**/*.rb"]
STATIC_FILES = Dir["src/static/**/*.{js,css,json}"]

build_plan = BuildPlan.new(digest_file: DIGEST_FILE)
BuildPlan.logger.level = Logger::INFO

site_files = []

build_plan.load do
  STATIC_FILES.each do |file|
    target = File.join("out/site", file["src/static".length..-1])

    grouped_file 'Static Files', target => [File.dirname(target), file] do
      contents = File.read(file)
      Zlib::GzipWriter.open(target) {|f| f.write(contents) }
    end
  end

  Actions::Index.new.tap do |builder|
    grouped_file 'Index', 'out/site/index.html' => [
      # 'out/metadata/index.yml',
      'src/erb/index.html.erb',
      LAYOUT_FILE,
      'out/site'
    ] do
      builder.compile_erb(LAYOUT_FILE, 'src/erb/index.html.erb', 'out/site/index.html')
    end
  end
end

SITE_FILES = build_plan.tasks.keys.select {|x| x.start_with?("out/site") }
DIRS = build_plan.tasks.values
  .select {|x| x.is_a?(BuildPlan::Target::IntermediaryFile) }
  .map {|x| File.dirname(x.target) }
  .uniq

build_plan.load do
  DIRS.each do |d|
    directory d
  end

  task "build" => SITE_FILES do
    # Just do this everytime, it's quick and not worth replicating rsync
    # functionality inside this file.
    `rsync -a data/images out/site/`
  end
end

build_plan.build "build"


build_plan.save_digests!(DIGEST_FILE)

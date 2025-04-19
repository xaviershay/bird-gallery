def slugify(name)
  name.downcase.gsub(/[^a-z-]+/, '-')
end